"""
Upload router – handles Revenue and COGS file uploads.
Files are saved to ./uploads/, parsed in the background,
and results stored as JSON blobs in UploadedMonth table.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
import traceback
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from database import get_db, SessionLocal
from models.upload import UploadedMonth
from models.user import User
from services.auth_service import get_current_user
from services.excel_parser import parse_revenue_file, parse_cogs_file, parse_pnl_file, parse_pnl_budget_file, parse_gl_india, parse_bs_file
from services.aggregator import build_cubes, build_canc_cubes

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/upload", tags=["upload"])

UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _upsert_month(
    db: Session,
    module: str,
    month_key: str,
    status: str,
    data_json: Optional[str] = None,
    message: Optional[str] = None,
) -> UploadedMonth:
    record = (
        db.query(UploadedMonth)
        .filter(UploadedMonth.module == module, UploadedMonth.month_key == month_key)
        .first()
    )
    if record is None:
        record = UploadedMonth(module=module, month_key=month_key)
        db.add(record)
    record.status = status
    if data_json is not None:
        record.data_json = data_json
    if message is not None:
        record.message = message
    db.commit()
    db.refresh(record)
    return record


# ── Background task: Revenue ──────────────────────────────────────────────────

def _process_revenue(file_path: str, month_key: str) -> None:
    db = SessionLocal()
    try:
        logger.info("Processing revenue file: %s  month: %s", file_path, month_key)

        result = parse_revenue_file(file_path, month_key)
        active_txs = result["transactions"]
        cancelled_txs = [
            tx for tx in result["all_transactions"]
            if tx.get("status", "").lower() != "active"
        ]

        cubes = build_cubes(active_txs, month_key)
        canc = build_canc_cubes(cancelled_txs)

        # Merge cancellation data into kpi cube
        cubes["kpi"]["canc_count"] = canc["canc_count"]
        cubes["kpi"]["canc_value"] = canc["canc_value"]
        cubes["canc_hr"] = canc["canc_hr"]
        cubes["canc_ch"] = canc["canc_ch"]

        data_json = json.dumps(cubes, default=str)
        _upsert_month(db, "revenue", month_key, "done", data_json=data_json,
                      message=f"Parsed {len(active_txs)} active rows, "
                              f"{len(cancelled_txs)} cancelled rows.")
        logger.info("Revenue processing done for %s", month_key)

    except Exception as exc:
        logger.error("Revenue processing failed: %s", traceback.format_exc())
        _upsert_month(db, "revenue", month_key, "error",
                      message=str(exc)[:500])
    finally:
        db.close()


# ── Background task: COGS ─────────────────────────────────────────────────────

def _process_cogs(file_path: str, month_key: str) -> None:
    db = SessionLocal()
    try:
        logger.info("Processing COGS file: %s  month: %s", file_path, month_key)

        # Try to pull net_revenue + service_charge from existing revenue upload
        net_revenue = 0.0
        service_charge = 0.0
        rev_record = (
            db.query(UploadedMonth)
            .filter(
                UploadedMonth.module == "revenue",
                UploadedMonth.month_key == month_key,
                UploadedMonth.status == "done",
            )
            .first()
        )
        if rev_record and rev_record.data_json:
            try:
                rev_data = json.loads(rev_record.data_json)
                kpi = rev_data.get("kpi", {})
                net_revenue = kpi.get("nr", 0.0)
                service_charge = kpi.get("sc", 0.0)
                logger.info(
                    "Pulled NR=%.2f SC=%.2f from revenue for COGS", net_revenue, service_charge
                )
            except Exception:
                pass

        result = parse_cogs_file(file_path, month_key, net_revenue, service_charge)
        data_json = json.dumps(result, default=str)
        _upsert_month(db, "cogs", month_key, "done", data_json=data_json,
                      message=f"COGS parsed. Accounting COG: {result['summary']['accounting_cog']:.2f}")
        logger.info("COGS processing done for %s", month_key)

    except Exception as exc:
        logger.error("COGS processing failed: %s", traceback.format_exc())
        _upsert_month(db, "cogs", month_key, "error",
                      message=str(exc)[:500])
    finally:
        db.close()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/revenue")
async def upload_revenue(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a Revenue Excel file for a given month."""
    import re
    # Parse multipart with 100MB limit
    form = await request.form(max_files=10, max_fields=20, max_part_size=100 * 1024 * 1024)
    file = form.get("file")
    month_key = form.get("month_key", "")

    if not file or not hasattr(file, "read"):
        raise HTTPException(status_code=400, detail="No file uploaded")
    if not re.match(r"^\d{4}-\d{2}$", month_key):
        raise HTTPException(status_code=400, detail="month_key must be YYYY-MM format")

    # Save file
    suffix = Path(file.filename).suffix if file.filename else ".xlsx"
    dest_path = UPLOAD_DIR / f"revenue_{month_key}{suffix}"
    content = await file.read()
    with open(dest_path, "wb") as buf:
        buf.write(content)

    # Mark as processing
    _upsert_month(db, "revenue", month_key, "processing",
                  message="File uploaded, processing started.")

    # Process in background
    background_tasks.add_task(_process_revenue, str(dest_path), month_key)

    return {
        "module": "revenue",
        "month_key": month_key,
        "status": "processing",
        "message": "File uploaded. Processing started in background.",
        "filename": file.filename,
    }


@router.post("/cogs")
async def upload_cogs(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a COGS Excel file for a given month."""
    import re
    form = await request.form(max_files=10, max_fields=20, max_part_size=100 * 1024 * 1024)
    file = form.get("file")
    month_key = form.get("month_key", "")

    if not file or not hasattr(file, "read"):
        raise HTTPException(status_code=400, detail="No file uploaded")
    if not re.match(r"^\d{4}-\d{2}$", month_key):
        raise HTTPException(status_code=400, detail="month_key must be YYYY-MM format")

    suffix = Path(file.filename).suffix if file.filename else ".xlsx"
    dest_path = UPLOAD_DIR / f"cogs_{month_key}{suffix}"
    content = await file.read()
    with open(dest_path, "wb") as buf:
        buf.write(content)

    _upsert_month(db, "cogs", month_key, "processing",
                  message="File uploaded, processing started.")

    background_tasks.add_task(_process_cogs, str(dest_path), month_key)

    return {
        "module": "cogs",
        "month_key": month_key,
        "status": "processing",
        "message": "File uploaded. Processing started in background.",
        "filename": file.filename,
    }


# ── Background task: P&L ─────────────────────────────────────────────────────

def _process_pnl(file_path: str, month_key: str) -> None:
    db = SessionLocal()
    try:
        logger.info("Processing P&L file: %s  month: %s", file_path, month_key)
        result = parse_pnl_file(file_path, month_key)
        data_json = json.dumps(result, default=str)
        _upsert_month(db, "pnl", month_key, "done", data_json=data_json,
                      message=f"P&L parsed. {len(result['hierarchy'])} line items, "
                              f"{len(result['stores'])} stores.")
        logger.info("P&L processing done for %s", month_key)

        # Also parse GL India for the interactive dashboard (covers all years/months)
        try:
            logger.info("Parsing GL India from %s (may take ~30s)...", file_path)
            gl_result = parse_gl_india(file_path)
            if gl_result:
                gl_json = json.dumps(gl_result, default=str)
                _upsert_month(db, "gl_india", "all", "done", data_json=gl_json,
                              message=f"GL India parsed. {len(gl_result.get('records', []))} aggregated records, "
                                      f"years={gl_result.get('years', [])}")
                logger.info("GL India processing done: %d records", len(gl_result.get("records", [])))
        except Exception as gl_exc:
            logger.error("GL India parsing failed (non-fatal): %s", gl_exc)
    except Exception as exc:
        logger.error("P&L processing failed: %s", traceback.format_exc())
        _upsert_month(db, "pnl", month_key, "error", message=str(exc)[:500])
    finally:
        db.close()


def _process_pnl_budget(file_path: str) -> None:
    """Parse budget file and store one record per month key."""
    db = SessionLocal()
    try:
        logger.info("Processing P&L budget file: %s", file_path)
        result = parse_pnl_budget_file(file_path)
        for mk, codes in result.items():
            data_json = json.dumps({"month_key": mk, "budget": codes}, default=str)
            _upsert_month(db, "pnl_budget", mk, "done", data_json=data_json,
                          message=f"Budget loaded: {len(codes)} line items for {mk}")
        logger.info("P&L budget processing done: %d months", len(result))
    except Exception as exc:
        logger.error("P&L budget processing failed: %s", traceback.format_exc())
    finally:
        db.close()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/pnl")
async def upload_pnl(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a P&L Excel/xlsb file for a given month."""
    import re
    form = await request.form(max_files=10, max_fields=20, max_part_size=100 * 1024 * 1024)
    file = form.get("file")
    month_key = form.get("month_key", "")

    if not file or not hasattr(file, "read"):
        raise HTTPException(status_code=400, detail="No file uploaded")
    if not re.match(r"^\d{4}-\d{2}$", month_key):
        raise HTTPException(status_code=400, detail="month_key must be YYYY-MM format")

    suffix = Path(file.filename).suffix if file.filename else ".xlsb"
    dest_path = UPLOAD_DIR / f"pnl_{month_key}{suffix}"
    content = await file.read()
    with open(dest_path, "wb") as buf:
        buf.write(content)

    _upsert_month(db, "pnl", month_key, "processing",
                  message="P&L file uploaded, processing started.")
    background_tasks.add_task(_process_pnl, str(dest_path), month_key)

    return {
        "module": "pnl",
        "month_key": month_key,
        "status": "processing",
        "message": "P&L file uploaded. Processing started.",
        "filename": file.filename,
    }


@router.post("/pnl-budget")
async def upload_pnl_budget(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a P&L budget CSV/Excel file (covers multiple months)."""
    form = await request.form(max_files=10, max_fields=20, max_part_size=20 * 1024 * 1024)
    file = form.get("file")

    if not file or not hasattr(file, "read"):
        raise HTTPException(status_code=400, detail="No file uploaded")

    suffix = Path(file.filename).suffix if file.filename else ".csv"
    dest_path = UPLOAD_DIR / f"pnl_budget{suffix}"
    content = await file.read()
    with open(dest_path, "wb") as buf:
        buf.write(content)

    background_tasks.add_task(_process_pnl_budget, str(dest_path))

    return {
        "module": "pnl_budget",
        "status": "processing",
        "message": "Budget file uploaded. Processing started.",
        "filename": file.filename,
    }


@router.get("/pnl-budget-template")
async def download_pnl_budget_template(
    current_user: User = Depends(get_current_user),
):
    """Download P&L budget template CSV."""
    from fastapi.responses import FileResponse
    template_path = Path("./pnl_budget_template.csv")
    if not template_path.exists():
        raise HTTPException(status_code=404, detail="Budget template not found")
    return FileResponse(
        path=str(template_path),
        media_type="text/csv",
        filename="pnl_budget_template.csv",
    )


# ── Background task: Balance Sheet ───────────────────────────────────────────

def _process_bs(file_path: str, month_key: str, mode: str) -> None:
    db = SessionLocal()
    try:
        logger.info("Processing BS file: %s  month: %s  mode: %s", file_path, month_key, mode)
        result = parse_bs_file(file_path, mode)

        # Determine the storage month_key
        store_key = "all" if mode == "full" else month_key

        data_json = json.dumps(result, default=str)
        periods = result.get("available_periods", [])
        hierarchy_len = len(result.get("bs_hierarchy", []))
        _upsert_month(
            db, "bs", store_key, "done", data_json=data_json,
            message=(
                f"BS parsed ({mode}). {len(periods)} periods available"
                + (f", {hierarchy_len} hierarchy rows" if mode == "full" else "")
                + f". Report month: {result.get('month_key', 'unknown')}."
            ),
        )
        logger.info("BS processing done for store_key=%s", store_key)

    except Exception as exc:
        logger.error("BS processing failed: %s", traceback.format_exc())
        store_key = "all" if mode == "full" else month_key
        _upsert_month(db, "bs", store_key, "error", message=str(exc)[:500])
    finally:
        db.close()


# ── Endpoint: Balance Sheet ───────────────────────────────────────────────────

@router.post("/bs")
async def upload_bs(
    request: Request,
    background_tasks: BackgroundTasks,
    mode: str = "full",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a Balance Sheet Excel/xlsb file.

    Query params:
      mode=full  (default) – full history; month_key optional (stored as 'all')
      mode=month            – single month; month_key required in form data
    """
    import re
    form = await request.form(max_files=10, max_fields=20, max_part_size=100 * 1024 * 1024)
    file = form.get("file")
    month_key = form.get("month_key", "") or ""

    if not file or not hasattr(file, "read"):
        raise HTTPException(status_code=400, detail="No file uploaded")

    if mode not in ("full", "month"):
        raise HTTPException(status_code=400, detail="mode must be 'full' or 'month'")

    if mode == "month":
        if not re.match(r"^\d{4}-\d{2}$", month_key):
            raise HTTPException(
                status_code=400,
                detail="month_key (YYYY-MM) is required when mode='month'",
            )

    # Determine the key used for storage and file naming
    store_key = "all" if mode == "full" else month_key
    suffix = Path(file.filename).suffix if file.filename else ".xlsb"
    dest_path = UPLOAD_DIR / f"bs_{store_key}{suffix}"
    content = await file.read()
    with open(dest_path, "wb") as buf:
        buf.write(content)

    _upsert_month(db, "bs", store_key, "processing",
                  message="BS file uploaded, processing started.")

    background_tasks.add_task(_process_bs, str(dest_path), month_key, mode)

    return {
        "module": "bs",
        "month_key": store_key,
        "mode": mode,
        "status": "processing",
        "message": "Balance Sheet file uploaded. Processing started.",
        "filename": file.filename,
    }


@router.get("/status")
async def get_upload_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the upload status for all months and modules."""
    records = db.query(UploadedMonth).order_by(
        UploadedMonth.module, UploadedMonth.month_key
    ).all()

    return [
        {
            "id": r.id,
            "module": r.module,
            "month_key": r.month_key,
            "status": r.status,
            "message": r.message,
            "uploaded_at": str(r.uploaded_at) if r.uploaded_at else None,
        }
        for r in records
    ]


@router.get("/status/{module}/{month_key}")
async def get_upload_status_single(
    module: str,
    month_key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return upload status for a specific module + month."""
    record = (
        db.query(UploadedMonth)
        .filter(
            UploadedMonth.module == module,
            UploadedMonth.month_key == month_key,
        )
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="No upload found")
    return {
        "module": record.module,
        "month_key": record.month_key,
        "status": record.status,
        "message": record.message,
        "uploaded_at": str(record.uploaded_at) if record.uploaded_at else None,
    }
