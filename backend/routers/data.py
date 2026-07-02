"""
Data router – serves all analytics endpoints.

All endpoints return data indexed by month_key:
  { "YYYY-MM": { ...data... }, ... }

The ?months= param is optional. When omitted, all available months are returned.
"""

from __future__ import annotations

import json
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models.upload import UploadedMonth
from models.user import User
from services.auth_service import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/data", tags=["data"])

DOW_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_all_months(db: Session, module: str, store_code: Optional[str] = None) -> List[str]:
    q = db.query(UploadedMonth.month_key).filter(
        UploadedMonth.module == module, UploadedMonth.status == "done"
    )
    if store_code:
        q = q.filter(UploadedMonth.store_code == store_code)
    else:
        q = q.filter(UploadedMonth.store_code.is_(None))
    records = q.all()
    # Fall back to all records if combined-only query returns nothing
    if not records and not store_code:
        records = (
            db.query(UploadedMonth.month_key)
            .filter(UploadedMonth.module == module, UploadedMonth.status == "done")
            .all()
        )
    return sorted({r.month_key for r in records})


def _resolve_months(
    months_str: Optional[str], db: Session, module: str = "revenue",
    store_code: Optional[str] = None,
) -> List[str]:
    if months_str:
        return [m.strip() for m in months_str.split(",") if m.strip()]
    return _get_all_months(db, module, store_code)


def _load_cube(
    db: Session, module: str, month_key: str, store_code: Optional[str] = None,
) -> Optional[dict]:
    q = db.query(UploadedMonth).filter(
        UploadedMonth.module == module,
        UploadedMonth.month_key == month_key,
        UploadedMonth.status == "done",
    )
    if store_code:
        record = q.filter(UploadedMonth.store_code == store_code).first()
    else:
        # Prefer combined (store_code IS NULL); fall back to first available
        record = q.filter(UploadedMonth.store_code.is_(None)).first()
        if not record:
            record = q.first()
    if record and record.data_json:
        try:
            return json.loads(record.data_json)
        except Exception as exc:
            logger.warning("Failed to parse %s JSON for %s: %s", module, month_key, exc)
    return None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/kpi")
async def get_kpi(
    months: Optional[str] = Query(None, description="Comma-separated YYYY-MM values"),
    store_code: Optional[str] = Query(None, description="Filter by outlet store_code"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """KPI summary per month. Returns {month_key: {net_revenue, ...}}."""
    month_keys = _resolve_months(months, db, "revenue", store_code)
    result = {}
    for mk in month_keys:
        cube = _load_cube(db, "revenue", mk, store_code)
        if not cube:
            continue
        kpi = cube.get("kpi", {})
        nr = kpi.get("nr", 0)
        sc = kpi.get("sc", 0)
        gst = kpi.get("gst", 0)
        result[mk] = {
            "net_revenue": nr,
            "gross_revenue": round(nr + sc + gst, 2),
            "total_invoices": kpi.get("inv_count", 0),
            "avg_bill": kpi.get("avg_bill", 0),
            "total_discount": kpi.get("disc", 0),
            "service_charge": sc,
            "total_gst": gst,
            "cancellations": kpi.get("canc_count", 0),
            "canc_value": kpi.get("canc_value", 0),
        }
    return result


@router.get("/daily")
async def get_daily(
    months: Optional[str] = Query(None),
    store_code: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Daily revenue breakdown per month. Returns {month_key: [{date, ...}]}."""
    month_keys = _resolve_months(months, db, "revenue", store_code)
    result = {}
    for mk in month_keys:
        cube = _load_cube(db, "revenue", mk, store_code)
        if not cube:
            continue
        daily = cube.get("daily", {})
        rows = []
        for date_str, d in sorted(daily.items()):
            inv_count = d.get("inv_count", 0)
            nr = d.get("nr", 0)
            rows.append({
                "date": date_str,
                "day_of_week": DOW_NAMES[d["dow"]] if d.get("dow") is not None else "",
                "dow": d.get("dow"),
                "net_revenue": nr,
                "total_invoices": inv_count,
                "avg_bill": round(nr / inv_count, 2) if inv_count > 0 else 0,
                "total_discount": d.get("disc", 0),
                "service_charge": d.get("sc", 0),
                "total_gst": d.get("gst", 0),
            })
        result[mk] = rows
    return result


@router.get("/hourly")
async def get_hourly(
    months: Optional[str] = Query(None),
    store_code: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Hourly revenue per month (IST hours 11-23). Returns {month_key: {hour: nr}}."""
    month_keys = _resolve_months(months, db, "revenue", store_code)
    result = {}
    for mk in month_keys:
        cube = _load_cube(db, "revenue", mk, store_code)
        if not cube:
            continue
        hr_sum = cube.get("hr_sum", {})
        result[mk] = {h: v.get("nr", 0) for h, v in hr_sum.items()}
    return result


@router.get("/cat-ch")
async def get_cat_ch(
    months: Optional[str] = Query(None),
    store_code: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Category x Channel breakdown per month."""
    month_keys = _resolve_months(months, db, "revenue", store_code)
    result = {}
    for mk in month_keys:
        cube = _load_cube(db, "revenue", mk, store_code)
        if not cube:
            continue
        cat_ch = cube.get("cat_ch", {})
        categories: dict = {}
        category_qty: dict = {}
        channels: dict = {}
        for key, val in cat_ch.items():
            parts = key.split("|", 1)
            cat = parts[0] if len(parts) > 0 else ""
            ch = parts[1] if len(parts) > 1 else ""
            categories[cat] = round(categories.get(cat, 0) + val.get("nr", 0), 2)
            category_qty[cat] = round(category_qty.get(cat, 0) + val.get("qty", 0), 2)
            channels[ch] = round(channels.get(ch, 0) + val.get("nr", 0), 2)
        result[mk] = {
            "categories": categories,
            "category_qty": category_qty,
            "channels": channels,
        }
    return result


@router.get("/items")
async def get_items(
    months: Optional[str] = Query(None),
    store_code: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Item totals per month. Returns {month_key: [{item_name, ...}]}."""
    month_keys = _resolve_months(months, db, "revenue", store_code)
    result = {}
    for mk in month_keys:
        cube = _load_cube(db, "revenue", mk, store_code)
        if not cube:
            continue
        items = cube.get("items", {})
        rows = sorted(
            [
                {
                    "item_name": k,
                    "category": v.get("cat", ""),
                    "net_revenue": v.get("nr", 0),
                    "qty": v.get("qty", 0),
                    "discount": v.get("disc", 0),
                    "gross_revenue": round(v.get("nr", 0) + v.get("disc", 0), 2),
                    "avg_price": v.get("avg_price", 0),
                }
                for k, v in items.items()
            ],
            key=lambda x: -x["net_revenue"],
        )
        result[mk] = rows[:limit]
    return result


@router.get("/heatmap")
async def get_heatmap(
    months: Optional[str] = Query(None),
    store_code: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """DOW x Hour heatmap per month. Returns {month_key: {DOW_name: {hour: {revenue, invoices, count}}}}."""
    month_keys = _resolve_months(months, db, "revenue", store_code)
    result = {}
    for mk in month_keys:
        cube = _load_cube(db, "revenue", mk, store_code)
        if not cube:
            continue
        dow_hr = cube.get("dow_hr", {})
        heatmap: dict = {}
        for key, val in dow_hr.items():
            parts = key.split("|", 1)
            if len(parts) != 2:
                continue
            dow_int = int(parts[0]) if parts[0].isdigit() else None
            hour = int(parts[1]) if parts[1].isdigit() else None
            if dow_int is None or hour is None:
                continue
            dow_name = DOW_NAMES[dow_int] if 0 <= dow_int <= 6 else str(dow_int)
            if dow_name not in heatmap:
                heatmap[dow_name] = {}
            heatmap[dow_name][hour] = {
                "revenue": val.get("nr", 0),
                "invoices": val.get("inv_count", 0),
                "count": int(val.get("qty", 0)),
            }
        result[mk] = heatmap
    return result


@router.get("/table-performance")
@router.get("/table-perf")
async def get_table_perf(
    months: Optional[str] = Query(None),
    store_code: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Table performance per month. Returns {month_key: {tables: {table_name: revenue}}}."""
    month_keys = _resolve_months(months, db, "revenue", store_code)
    result = {}
    for mk in month_keys:
        cube = _load_cube(db, "revenue", mk, store_code)
        if not cube:
            continue
        table_hr = cube.get("table_hr", {})
        tables: dict = {}
        for key, val in table_hr.items():
            parts = key.split("|", 1)
            table_name = parts[0] if parts else ""
            if not table_name:
                continue
            tables[table_name] = round(tables.get(table_name, 0) + val.get("nr", 0), 2)
        result[mk] = {"tables": tables}
    return result


@router.get("/cogs")
async def get_cogs(
    months: Optional[str] = Query(None),
    store_code: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """COGS summary and ingredient data per month."""
    month_keys = _resolve_months(months, db, "cogs", store_code)
    result = {}
    for mk in month_keys:
        cube = _load_cube(db, "cogs", mk, store_code)
        if not cube:
            continue
        summary = cube.get("summary", {})
        ingredients_raw = cube.get("ingredients", [])

        # Build ingredient groups
        groups: dict = {}
        for ing in ingredients_raw:
            group = ing.get("group_item") or "Other"
            if group not in groups:
                groups[group] = {"accounting": 0.0, "standard": 0.0}
            groups[group]["accounting"] += float(ing.get("amt_actual", 0) or 0)
            groups[group]["standard"] += float(ing.get("cog_std", 0) or 0)

        # Map raw ingredient fields to frontend-expected names
        ingredients = []
        for ing in ingredients_raw:
            name = ing.get("item_description", "") or ""
            if not name:
                continue
            ingredients.append({
                "name": name,
                "group": ing.get("group_item", "Other") or "Other",
                "unit": ing.get("min_uom", "") or "",
                "opening_stock": float(ing.get("qty_ob", 0) or 0),
                "purchased": float(ing.get("qty_purchase", 0) or 0),
                "actual_consumption": float(ing.get("qty_actual", 0) or 0),
                "standard_consumption": float(ing.get("cog_std", 0) or 0),
                "closing_stock": float(ing.get("qty_closing", 0) or 0),
                "waste": float(ing.get("food_wastage", 0) or 0),
                "cost": float(ing.get("amt_actual", 0) or 0),
            })

        result[mk] = {
            "accounting_cog": summary.get("accounting_cog", 0),
            "standard_cog": summary.get("standard_cog", 0),
            "wastage": summary.get("food_wastage", 0),
            "store_variance": summary.get("store_variance", 0),
            "total_adj": summary.get("total_adjustment", 0),
            "cog_variance": summary.get("cog_variance", 0),
            "gross_margin": summary.get("gross_margin", 0),
            "groups": groups,
            "ingredients": ingredients,
        }
    return result


@router.get("/discount")
async def get_discount(
    months: Optional[str] = Query(None),
    store_code: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Discount breakdown per month."""
    month_keys = _resolve_months(months, db, "revenue", store_code)
    result = {}
    for mk in month_keys:
        cube = _load_cube(db, "revenue", mk, store_code)
        if not cube:
            continue
        disc_ch = cube.get("disc_ch", {})
        items = cube.get("items", {})
        result[mk] = {
            "by_channel": {ch: v.get("disc", 0) for ch, v in disc_ch.items()},
            "channel_revenue": {ch: v.get("nr", 0) for ch, v in disc_ch.items()},
            "by_item": sorted(
                [
                    {
                        "item_name": k,
                        "category": v.get("cat", ""),
                        "discount": v.get("disc", 0),
                        "revenue": v.get("nr", 0),
                    }
                    for k, v in items.items()
                    if v.get("disc", 0) > 0
                ],
                key=lambda x: -x["discount"],
            )[:50],
        }
    return result


@router.get("/voids")
async def get_voids(
    months: Optional[str] = Query(None),
    store_code: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancellation data per month."""
    month_keys = _resolve_months(months, db, "revenue", store_code)
    result = {}
    for mk in month_keys:
        cube = _load_cube(db, "revenue", mk, store_code)
        if not cube:
            continue
        kpi = cube.get("kpi", {})
        canc_hr = cube.get("canc_hr", {})
        canc_ch = cube.get("canc_ch", {})

        by_hour = {}
        for h, v in canc_hr.items():
            by_hour[str(h)] = v.get("count", 0) if isinstance(v, dict) else 0

        by_channel = {}
        for ch, v in canc_ch.items():
            by_channel[ch] = v.get("count", 0) if isinstance(v, dict) else int(v)

        result[mk] = {
            "cancelled_value": kpi.get("canc_value", 0),
            "by_channel": by_channel,
            "by_hour": by_hour,
        }
    return result


@router.get("/gst")
async def get_gst(
    months: Optional[str] = Query(None),
    store_code: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """GST breakdown by slab per month."""
    month_keys = _resolve_months(months, db, "revenue", store_code)
    result = {}
    for mk in month_keys:
        cube = _load_cube(db, "revenue", mk, store_code)
        if not cube:
            continue
        gst_slab = cube.get("gst_slab", {})
        result[mk] = {
            "slabs": {
                rate: {
                    "taxable": v.get("nr", 0),
                    "gst": v.get("gst", 0),
                    "qty": v.get("qty", 0),
                }
                for rate, v in gst_slab.items()
            }
        }
    return result


@router.get("/top-invoices")
async def get_top_invoices(
    months: Optional[str] = Query(None),
    store_code: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Top invoices per month. Returns {month_key: [{net_revenue, channel, ...}]}."""
    month_keys = _resolve_months(months, db, "revenue", store_code)
    result = {}
    for mk in month_keys:
        cube = _load_cube(db, "revenue", mk, store_code)
        if not cube:
            continue
        invoices = cube.get("top_invoices", [])
        rows = []
        for inv in sorted(invoices, key=lambda x: -x.get("nr", 0))[:limit]:
            date_str = inv.get("date", "")
            dow = None
            if date_str:
                try:
                    from datetime import date as _date
                    d = _date.fromisoformat(date_str)
                    dow = DOW_NAMES[d.weekday()]
                except Exception:
                    pass
            rows.append({
                "net_revenue": inv.get("nr", 0),
                "discount": inv.get("disc", 0),
                "service_charge": inv.get("sc", 0),
                "gst": inv.get("gst", 0),
                "channel": inv.get("channel", ""),
                "table": inv.get("table", ""),
                "date": date_str,
                "day_of_week": dow or "",
                "hour": inv.get("ist_hour"),
                "inv_key": inv.get("inv_key", ""),
            })
        result[mk] = rows
    return result


@router.get("/pnl")
async def get_pnl(
    months: Optional[str] = Query(None, description="Comma-separated YYYY-MM values"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    P&L data per month.
    Returns {month_key: {hierarchy, stores, actuals, prior, budget}}.
    Prior month: prefers separately uploaded month; falls back to embedded prior cols.
    """
    month_keys = _resolve_months(months, db, "pnl")
    result = {}
    for mk in month_keys:
        cube = _load_cube(db, "pnl", mk)
        if not cube:
            continue

        # Derive prior month key
        y, m = mk.split("-")
        if int(m) > 1:
            prior_mk = f"{y}-{int(m) - 1:02d}"
        else:
            prior_mk = f"{int(y) - 1}-12"

        # Prefer separately uploaded prior month actuals; fall back to embedded
        prior_cube = _load_cube(db, "pnl", prior_mk)
        if prior_cube:
            prior_data = prior_cube.get("actuals", {})
        else:
            prior_data = cube.get("prior_embedded", {})

        # Budget data
        budget_cube = _load_cube(db, "pnl_budget", mk)
        budget_data = budget_cube.get("budget", {}) if budget_cube else {}

        result[mk] = {
            "hierarchy": cube.get("hierarchy", []),
            "stores": cube.get("stores", []),
            "actuals": cube.get("actuals", {}),
            "prior": prior_data,
            "budget": budget_data,
            "pivot_breakdown": cube.get("pivot_breakdown", {}),
        }
    return result


# ── Shared helpers ─────────────────────────────────────────────────────────────

def _gl_norm_store(s) -> Optional[str]:
    if not s or str(s) in ("0.0", "None", ""):
        return None
    sl = str(s).lower()
    if "indiranagar" in sl or "idn" in sl:
        return "BGL-IDN"
    if "bagmane" in sl or "bsc" in sl:
        return "BGL-BSC"
    if "back office" in sl:
        return "Back Office"
    if "cheese factory" in sl or " cf " in sl:
        return "BGL-CF"
    if "hub" in sl or "did" in sl:
        return "BGL-DID"
    return str(s)


def _gl_get_level(code: int) -> int:
    s = str(code)
    tz = len(s) - len(s.rstrip("0"))
    if tz >= 5: return 0
    if tz >= 4: return 1
    if tz >= 2: return 2
    return 3


_INCOME_GROUPS = {"net revenue", "financial income", "other income"}


def _compute_pnl_actuals(records, hierarchy, display_stores: list) -> dict:
    """
    Compute P&L display values from GL records.
    Returns: {code_str: {store: display_value}}
    Uses group_pnl for sign (income groups negated), bottom-up summation,
    then hardcoded formulas for GP/EBITDA/PBT/NP.
    """
    TOTAL = display_stores[0]  # e.g. "India Total"

    # 1. Aggregate GL records by (code_pnl, store)
    gl_agg: dict = {}   # {code_str: {store: net_amt_sum}}
    gl_group: dict = {} # {code_str: group_pnl}
    for r in records:
        code = str(int(float(r["code_pnl"])))
        store = r.get("norm_store") or _gl_norm_store(r["store"]) or "Unknown"
        amt = r["net_amt"]
        group = r["group_pnl"]
        if code not in gl_agg:
            gl_agg[code] = {}
            gl_group[code] = group
        gl_agg[code][store] = gl_agg[code].get(store, 0.0) + amt

    # Add total column
    for code, store_dict in gl_agg.items():
        gl_agg[code][TOTAL] = sum(store_dict.values())

    # 2. Apply sign correction: income groups → negate
    computed: dict = {}
    for code, store_dict in gl_agg.items():
        group = gl_group[code]
        sign = -1 if group.lower() in _INCOME_GROUPS else 1
        computed[code] = {st: store_dict.get(st, 0.0) * sign for st in display_stores}

    # 3. Bottom-up: sum leaf GL descendants for aggregate hierarchy codes
    hier_levels = [_gl_get_level(row["code"]) for row in hierarchy]
    gl_codes = set(gl_agg.keys())

    for i in range(len(hierarchy) - 1, -1, -1):
        code = str(hierarchy[i]["code"])
        level = hier_levels[i]
        if code in gl_codes:
            continue  # already computed from GL step
        val = {st: 0.0 for st in display_stores}
        for j in range(i + 1, len(hierarchy)):
            if hier_levels[j] <= level:
                break
            child_code = str(hierarchy[j]["code"])
            if child_code in gl_codes:
                for st in display_stores:
                    val[st] += computed.get(child_code, {}).get(st, 0.0)
        computed[code] = val

    def _c(code_str, st):
        return computed.get(code_str, {}).get(st, 0.0)

    # 4. Formula codes (hardcoded accounting relationships)
    # D&A = leaf D&A codes only (exclude FinInc/OthInc that share the range in the flat hierarchy)
    computed["410000"] = {
        st: _c("410001", st) + _c("410002", st)
        for st in display_stores
    }
    # GP = NR - COGS
    computed["300000"] = {st: _c("100000", st) - _c("200000", st) for st in display_stores}
    # EBITDA = GP - Total OpEx
    computed["400000"] = {st: _c("300000", st) - _c("310000", st) for st in display_stores}
    # PBT = EBITDA - D&A + FinInc - FinExp + OthInc - OthExp
    computed["500000"] = {
        st: _c("400000", st) - _c("410000", st)
            + _c("421000", st) - _c("422000", st)
            + _c("431000", st) - _c("432000", st)
        for st in display_stores
    }
    # Net Profit = PBT - Tax
    computed["700000"] = {st: _c("500000", st) - _c("600000", st) for st in display_stores}

    return computed


@router.get("/gl-dashboard")
async def get_gl_dashboard(
    year: Optional[int] = Query(None, description="Filter by year (e.g. 2026)"),
    month: Optional[int] = Query(None, description="Filter by month 1-12"),
    store: Optional[str] = Query(None, description="Filter by store name"),
    year_from: Optional[int] = Query(None, description="Range start year"),
    month_from: Optional[int] = Query(None, description="Range start month 1-12"),
    year_to: Optional[int] = Query(None, description="Range end year"),
    month_to: Optional[int] = Query(None, description="Range end month 1-12"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Interactive GL dashboard data derived from GL India sheet.
    Returns aggregated records filterable by year/month/store or date range.
    Also returns: monthly_trend, category_breakdown, store_breakdown, group_breakdown, expert_metrics, available_periods.
    """
    import math as _math

    record = (
        db.query(UploadedMonth)
        .filter(UploadedMonth.module == "gl_india", UploadedMonth.month_key == "all",
                UploadedMonth.status == "done")
        .first()
    )
    if not record or not record.data_json:
        return {"available": False, "records": [], "years": [], "months": [], "stores": [], "available_periods": []}

    try:
        gl = json.loads(record.data_json)
    except Exception:
        return {"available": False, "records": [], "available_periods": []}

    import math as _math_gl

    def _safe_amt(v):
        """Replace NaN / inf / None with 0.0 so JSON serialisation never fails."""
        try:
            f = float(v) if v is not None else 0.0
            return 0.0 if (_math_gl.isnan(f) or _math_gl.isinf(f)) else f
        except (TypeError, ValueError):
            return 0.0

    # Pre-sanitise net_amt once so all downstream arithmetic stays clean
    all_records = [{**r, "net_amt": _safe_amt(r.get("net_amt")),
                    "inr_amt": _safe_amt(r.get("inr_amt"))}
                   for r in gl.get("records", [])]

    # ── Build available_periods from all records ──────────────────────────────
    period_set = set()
    for r in all_records:
        period_set.add((r["year"], r["month"]))
    available_periods = sorted(
        [{"year": y, "month": m} for y, m in period_set],
        key=lambda x: x["year"] * 100 + x["month"]
    )

    # ── Apply filters ────────────────────────────────────────────────────────
    filtered = all_records
    if year_from and year_to:
        # Allow year-only range (no month required); default month_from=1, month_to=12
        lo = year_from * 100 + (month_from or 1)
        hi = year_to   * 100 + (month_to   or 12)
        filtered = [r for r in filtered if lo <= r["year"] * 100 + r["month"] <= hi]
    elif year is not None:
        filtered = [r for r in filtered if r["year"] == year]
        if month is not None:
            filtered = [r for r in filtered if r["month"] == month]
    if store is not None:
        filtered = [r for r in filtered if store.lower() in r["store"].lower()]

    def _agg(recs, key_fn):
        out = {}
        for r in recs:
            k = key_fn(r)
            if k not in out:
                out[k] = {"net_amt": 0.0, "inr_amt": 0.0}
            out[k]["net_amt"] += r["net_amt"]
            out[k]["inr_amt"] += r["inr_amt"]
        return out

    # ── Monthly trend (all years) ─────────────────────────────────────────────
    # Group by year-month, sum revenue (negative net_amt for revenue groups)
    month_labels = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    fy_months = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]  # FY Apr-Mar order

    # For trend: use all records grouped by year+month
    trend_agg = {}
    for r in all_records:
        k = (r["year"], r["month"])
        if k not in trend_agg:
            trend_agg[k] = {"revenue": 0.0, "cogs": 0.0, "net_raw": 0.0}
        g = r["group_pnl"].lower()
        amt = r["net_amt"]
        if g == "net revenue":
            trend_agg[k]["revenue"] -= amt   # revenue is negative in GL (credit)
        elif g == "cost of sales":
            trend_agg[k]["cogs"] += amt       # cogs is positive (debit)
        trend_agg[k]["net_raw"] -= amt        # net profit = negation of all entries

    monthly_trend = []
    for (y, m), v in sorted(trend_agg.items()):
        gp = v["revenue"] - v["cogs"]
        gp_pct = gp / v["revenue"] if v["revenue"] else 0
        np = v["net_raw"]
        np_pct = np / v["revenue"] if v["revenue"] else 0
        monthly_trend.append({
            "year": y,
            "month": m,
            "month_label": f"{month_labels[m]} {str(y)[2:]}",
            "revenue": round(v["revenue"], 2),
            "cogs": round(v["cogs"], 2),
            "gross_profit": round(gp, 2),
            "gp_pct": round(gp_pct, 4),
            "net_profit": round(np, 2),
            "np_pct": round(np_pct, 4),
        })

    revenue_groups = {"net revenue"}
    cogs_groups = {"cost of sales"}

    # ── Category breakdown (for selected filter window) ────────────────────
    cat_agg = {}
    for r in filtered:
        cat = r["category"]
        g = r["group_pnl"].lower()
        if cat not in cat_agg:
            cat_agg[cat] = {"revenue": 0.0, "cogs": 0.0}
        amt = r["net_amt"]
        if g in revenue_groups:
            cat_agg[cat]["revenue"] -= amt
        elif g in cogs_groups:
            cat_agg[cat]["cogs"] += amt
        elif cat in ("Financial Income", "Other Income"):
            cat_agg[cat]["revenue"] -= amt

    # Only include meaningful categories for breakdown table
    DASHBOARD_CATS = {"Dine-in", "Financial Income", "Other Income"}
    category_breakdown = []
    for cat, v in cat_agg.items():
        if cat not in DASHBOARD_CATS:
            continue
        gp = v["revenue"] - v["cogs"]
        gp_pct = gp / v["revenue"] if v["revenue"] else 1.0
        category_breakdown.append({
            "category": cat,
            "revenue": round(v["revenue"], 2),
            "cogs": round(v["cogs"], 2),
            "gross_profit": round(gp, 2),
            "gp_pct": round(gp_pct, 4),
        })
    # Add grand total
    if category_breakdown:
        total_rev = sum(c["revenue"] for c in category_breakdown)
        total_cogs = sum(c["cogs"] for c in category_breakdown)
        total_gp = total_rev - total_cogs
        category_breakdown.append({
            "category": "Total",
            "revenue": round(total_rev, 2),
            "cogs": round(total_cogs, 2),
            "gross_profit": round(total_gp, 2),
            "gp_pct": round(total_gp / total_rev, 4) if total_rev else 0,
        })

    # ── Store breakdown (normalize store names, merge duplicates) ──────────
    store_agg = {}
    for r in filtered:
        sn = _gl_norm_store(r["store"])
        if sn is None:
            continue
        g = r["group_pnl"].lower()
        if sn not in store_agg:
            store_agg[sn] = {"revenue": 0.0, "cogs": 0.0, "opex": 0.0}
        amt = r["net_amt"]
        if g in revenue_groups:
            store_agg[sn]["revenue"] -= amt
        elif g in cogs_groups:
            store_agg[sn]["cogs"] += amt
        elif g not in ("financial income", "other income"):
            store_agg[sn]["opex"] += amt

    store_breakdown = []
    for sn, v in store_agg.items():
        gp = v["revenue"] - v["cogs"]
        ebitda = gp - v["opex"]
        gp_pct = gp / v["revenue"] if v["revenue"] else 0
        ebitda_pct = ebitda / v["revenue"] if v["revenue"] else 0
        store_breakdown.append({
            "store": sn,
            "revenue": round(v["revenue"], 2),
            "cogs": round(v["cogs"], 2),
            "gross_profit": round(gp, 2),
            "opex": round(v["opex"], 2),
            "ebitda": round(ebitda, 2),
            "gp_pct": round(gp_pct, 4),
            "ebitda_pct": round(ebitda_pct, 4),
        })
    store_breakdown.sort(key=lambda x: -x["revenue"])

    # ── Group breakdown (P&L group level) ─────────────────────────────────
    group_agg = {}
    for r in filtered:
        g = r["group_pnl"]
        mi = r["pnl_mapping"]
        if g not in group_agg:
            group_agg[g] = {"total": 0.0, "items": {}}
        group_agg[g]["total"] += r["net_amt"]
        group_agg[g]["items"][mi] = group_agg[g]["items"].get(mi, 0.0) + r["net_amt"]

    group_breakdown = []
    for g, v in group_agg.items():
        group_breakdown.append({
            "group": g,
            "total": round(v["total"], 2),
            "items": [{"label": k, "value": round(val, 2)}
                      for k, val in sorted(v["items"].items(), key=lambda x: -abs(x[1]))],
        })
    group_breakdown.sort(key=lambda x: -abs(x["total"]))

    # ── Expert metrics ─────────────────────────────────────────────────────
    # Use the Total row from category_breakdown
    total_row = next((c for c in category_breakdown if c["category"] == "Total"), None)
    total_rev  = total_row["revenue"] if total_row else 0
    total_cogs = total_row["cogs"] if total_row else 0
    total_gp   = total_row["gross_profit"] if total_row else 0

    # Labour from group breakdown (positive debit = expense)
    labour_group = next((g for g in group_breakdown if g["group"] == "Labour costs"), None)
    labour = abs(labour_group["total"]) if labour_group else 0

    opex_groups = {"Net Revenue", "Cost of Sales", "Financial Income", "Other Income"}
    opex_total = sum(abs(g["total"]) for g in group_breakdown if g["group"] not in opex_groups)
    ebitda = total_gp - opex_total

    net_profit = -sum(r["net_amt"] for r in filtered)

    expert_metrics = {
        "total_revenue": round(total_rev, 2),
        "food_cost_pct": round(total_cogs / total_rev, 4) if total_rev else 0,
        "labour_cost_pct": round(labour / total_rev, 4) if total_rev else 0,
        "gross_profit_pct": round(total_gp / total_rev, 4) if total_rev else 0,
        "ebitda": round(ebitda, 2),
        "ebitda_pct": round(ebitda / total_rev, 4) if total_rev else 0,
        "net_profit": round(net_profit, 2),
        "net_profit_pct": round(net_profit / total_rev, 4) if total_rev else 0,
        "revenue_per_day": round(total_rev / 30, 2),
        "top_expenses": sorted(
            [{"label": g["group"], "value": round(abs(g["total"]), 2)}
             for g in group_breakdown if g["group"] not in opex_groups],
            key=lambda x: -x["value"]
        )[:5],
    }

    # ── Category monthly trend (from ALL records, unfiltered, for trend charts) ──
    import math as _math
    def _safe(v):
        """Return 0.0 for NaN/inf/None so JSON serialisation never fails."""
        try:
            return 0.0 if (v is None or _math.isnan(v) or _math.isinf(v)) else float(v)
        except (TypeError, ValueError):
            return 0.0

    _label = lambda y, m: f"{['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m]} {str(y)[2:]}"
    cat_trend_agg: dict = {}  # {category: {(year,month): value}}
    for r in all_records:
        cat = r.get("category") or r.get("pnl_mapping") or "Other"
        if str(r.get("group_pnl", "")).lower() not in _INCOME_GROUPS:
            continue  # only revenue categories
        amt = _safe(r.get("net_amt"))
        key = (r["year"], r["month"])
        if cat not in cat_trend_agg:
            cat_trend_agg[cat] = {}
        cat_trend_agg[cat][key] = cat_trend_agg[cat].get(key, 0.0) + abs(amt)
    all_period_keys = sorted(period_set, key=lambda x: x[0] * 100 + x[1])
    category_monthly_trend = [
        {
            "category": cat,
            "data": [
                {"year": y, "month": m, "month_label": _label(y, m),
                 "value": round(_safe(vals.get((y, m), 0.0)), 2)}
                for y, m in all_period_keys
            ]
        }
        for cat, vals in sorted(cat_trend_agg.items())
    ]

    # ── Group monthly trend (all groups across all periods) ────────────────────
    grp_trend_agg: dict = {}  # {group: {(year,month): value}}
    for r in all_records:
        g = r.get("group_pnl") or "Other"
        if str(g).lower() in _INCOME_GROUPS:
            continue  # expense groups only
        amt = _safe(r.get("net_amt"))
        key = (r["year"], r["month"])
        if g not in grp_trend_agg:
            grp_trend_agg[g] = {}
        grp_trend_agg[g][key] = grp_trend_agg[g].get(key, 0.0) + abs(amt)
    group_monthly_trend = [
        {
            "group": g,
            "data": [
                {"year": y, "month": m, "month_label": _label(y, m),
                 "value": round(_safe(vals.get((y, m), 0.0)), 2)}
                for y, m in all_period_keys
            ]
        }
        for g, vals in sorted(grp_trend_agg.items())
    ]

    # Normalise unique store names in metadata
    norm_stores = sorted({_gl_norm_store(s) for s in gl.get("stores", [])
                          if _gl_norm_store(s) is not None})

    return {
        "available": True,
        "years": gl.get("years", []),
        "months": gl.get("months", []),
        "stores": norm_stores,
        "groups": gl.get("groups", []),
        "available_periods": available_periods,
        "monthly_trend": monthly_trend,
        "category_breakdown": category_breakdown,
        "category_monthly_trend": category_monthly_trend,
        "group_monthly_trend": group_monthly_trend,
        "store_breakdown": store_breakdown,
        "group_breakdown": group_breakdown,
        "expert_metrics": expert_metrics,
    }


@router.get("/pnl-from-gl")
async def get_pnl_from_gl(
    year: Optional[int] = Query(None),
    month: Optional[int] = Query(None),
    year_from: Optional[int] = Query(None),
    month_from: Optional[int] = Query(None),
    year_to: Optional[int] = Query(None),
    month_to: Optional[int] = Query(None),
    store: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Compute P&L for any period directly from GL India data.
    Returns same structure as /data/pnl for compatibility.
    """
    # 1. Load GL India data
    gl_record = (
        db.query(UploadedMonth)
        .filter(UploadedMonth.module == "gl_india", UploadedMonth.month_key == "all",
                UploadedMonth.status == "done")
        .first()
    )
    if not gl_record or not gl_record.data_json:
        # GL India missing — return hierarchy skeleton so P&L table still renders
        pnl_rec_fb = (
            db.query(UploadedMonth)
            .filter(UploadedMonth.module == "pnl", UploadedMonth.status == "done")
            .order_by(UploadedMonth.month_key.desc())
            .first()
        )
        hierarchy_fb: list = []
        if pnl_rec_fb and pnl_rec_fb.data_json:
            try:
                hierarchy_fb = json.loads(pnl_rec_fb.data_json).get("hierarchy", [])
            except Exception:
                pass
        return {
            "available": False,
            "error": "GL India data not found. Re-upload the P&L file to recompute.",
            "hierarchy": hierarchy_fb,
            "stores": [],
            "actuals": {},
            "prior": {},
            "budget": {},
            "available_periods": [],
        }

    gl = json.loads(gl_record.data_json)

    import math as _math_pnl

    def _safe_r(v):
        try:
            f = float(v) if v is not None else 0.0
            return 0.0 if (_math_pnl.isnan(f) or _math_pnl.isinf(f)) else f
        except (TypeError, ValueError):
            return 0.0

    all_records = [{**r, "net_amt": _safe_r(r.get("net_amt"))}
                   for r in gl.get("records", [])]

    # 2. Build available_periods
    period_set = set()
    for r in all_records:
        period_set.add((r["year"], r["month"]))
    available_periods = sorted(
        [{"year": y, "month": m} for y, m in period_set],
        key=lambda x: x["year"] * 100 + x["month"]
    )

    # 3. Load hierarchy from latest PnL upload
    pnl_rec = (
        db.query(UploadedMonth)
        .filter(UploadedMonth.module == "pnl", UploadedMonth.status == "done")
        .order_by(UploadedMonth.month_key.desc())
        .first()
    )
    if not pnl_rec or not pnl_rec.data_json:
        return {"available": False, "error": "No P&L hierarchy uploaded. Upload a P&L file first."}

    pnl_cube = json.loads(pnl_rec.data_json)
    hierarchy = pnl_cube.get("hierarchy", [])
    if not hierarchy:
        return {"available": False, "error": "Empty P&L hierarchy."}

    def _filter_records(recs, yr=None, mo=None, yr_from=None, mo_from=None,
                        yr_to=None, mo_to=None, st=None):
        out = recs
        if yr_from and yr_to:
            lo = yr_from * 100 + (mo_from or 1)
            hi = yr_to   * 100 + (mo_to   or 12)
            out = [r for r in out if lo <= r["year"] * 100 + r["month"] <= hi]
        elif yr is not None:
            out = [r for r in out if r["year"] == yr]
            if mo is not None:
                out = [r for r in out if r["month"] == mo]
        if st:
            out = [r for r in out if st.lower() in (r["store"] or "").lower()]
        return out

    # 4. Normalize store names in filtered records
    def _norm_records(recs):
        out = []
        for r in recs:
            ns = _gl_norm_store(r["store"])
            if ns is None:
                continue
            out.append({**r, "norm_store": ns})
        return out

    filtered_raw = _filter_records(all_records, year, month, year_from, month_from,
                                   year_to, month_to, store)
    filtered = _norm_records(filtered_raw)

    all_norm_stores = sorted({r["norm_store"] for r in filtered})
    TOTAL = "India Total"
    display_stores = [TOTAL] + all_norm_stores

    # 5. Compute actuals
    actuals_by_code = _compute_pnl_actuals(filtered, hierarchy, display_stores)

    # 6. Build actuals in format {store: {code: value}}
    actuals: dict = {st: {} for st in display_stores}
    for row in hierarchy:
        code = str(row["code"])
        for st in display_stores:
            actuals[st][code] = round(actuals_by_code.get(code, {}).get(st, 0.0), 2)

    # 7. Compute prior period (previous month if single, or preceding range)
    prior: dict = {st: {} for st in display_stores}
    if year is not None and month is not None:
        prior_y = year if month > 1 else year - 1
        prior_m = month - 1 if month > 1 else 12
        prior_raw = _filter_records(all_records, yr=prior_y, mo=prior_m, st=store)
        prior_norm = _norm_records(prior_raw)
        if prior_norm:
            prior_by_code = _compute_pnl_actuals(prior_norm, hierarchy, display_stores)
            for row in hierarchy:
                code = str(row["code"])
                for st in display_stores:
                    prior[st][code] = round(prior_by_code.get(code, {}).get(st, 0.0), 2)

    # 8. Budget data (from uploaded budget if available for this month)
    budget: dict = {}
    if year and month:
        mk = f"{year}-{month:02d}"
        bgt_rec = (
            db.query(UploadedMonth)
            .filter(UploadedMonth.module == "pnl_budget", UploadedMonth.month_key == mk,
                    UploadedMonth.status == "done")
            .first()
        )
        if bgt_rec and bgt_rec.data_json:
            bgt_cube = json.loads(bgt_rec.data_json)
            budget = bgt_cube.get("budget", {})

    return {
        "available": True,
        "hierarchy": hierarchy,
        "stores": display_stores,
        "actuals": actuals,
        "prior": prior,
        "budget": budget,
        "available_periods": available_periods,
    }


@router.get("/menu")
async def get_menu(
    store_code: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Menu engineering data aggregated across all COGS months."""
    q = db.query(UploadedMonth).filter(
        UploadedMonth.module == "cogs", UploadedMonth.status == "done"
    )
    if store_code:
        q = q.filter(UploadedMonth.store_code == store_code)
    else:
        q = q.filter(UploadedMonth.store_code.is_(None))
    records = q.all()
    if not records and not store_code:
        records = (db.query(UploadedMonth)
            .filter(UploadedMonth.module == "cogs", UploadedMonth.status == "done").all())
    all_menu_eng = []
    all_exploded = []
    for record in records:
        if record.data_json:
            try:
                data = json.loads(record.data_json)
                all_menu_eng.extend(data.get("menu_engineering", []))
                all_exploded.extend(data.get("exploded_parent", []))
            except Exception as exc:
                logger.warning("Failed to parse COGS JSON for %s: %s", record.month_key, exc)
    return {
        "months": [r.month_key for r in records],
        "menu_engineering": all_menu_eng,
        "exploded_parent": all_exploded,
        "total_menu_items": len(all_menu_eng),
    }


# ── Helpers: Balance Sheet ─────────────────────────────────────────────────────

def _load_bs_data(db: Session) -> Optional[dict]:
    """Try loading BS module: 'all' (full history) first, then latest month record."""
    record = (
        db.query(UploadedMonth)
        .filter(UploadedMonth.module == "bs", UploadedMonth.month_key == "all",
                UploadedMonth.status == "done")
        .first()
    )
    if not record:
        record = (
            db.query(UploadedMonth)
            .filter(UploadedMonth.module == "bs", UploadedMonth.status == "done")
            .order_by(UploadedMonth.month_key.desc())
            .first()
        )
    if not record or not record.data_json:
        return None
    try:
        return json.loads(record.data_json)
    except Exception:
        return None


def _filter_monthly_trend(
    monthly_trend: list,
    year: Optional[int],
    month: Optional[int],
    year_from: Optional[int],
    month_from: Optional[int],
    year_to: Optional[int],
    month_to: Optional[int],
) -> list:
    """Filter monthly_trend list by the given year/month parameters."""
    if year_from is not None and year_to is not None:
        lo = year_from * 100 + (month_from or 1)
        hi = year_to * 100 + (month_to or 12)
        return [t for t in monthly_trend if lo <= t["year"] * 100 + t["month"] <= hi]
    if year is not None:
        filtered = [t for t in monthly_trend if t["year"] == year]
        if month is not None:
            filtered = [t for t in monthly_trend if t["year"] == year and t["month"] == month]
        return filtered
    return monthly_trend


# ── GET /data/bs-dashboard ────────────────────────────────────────────────────

@router.get("/bs-dashboard")
async def get_bs_dashboard(
    store: Optional[str] = Query(None, description="Filter by store (reserved for future use)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Balance Sheet dashboard data.
    Always returns the FULL monthly_trend (all available periods) so the frontend
    can select any period's KPI values dynamically without a re-fetch.
    Each trend entry is enriched with current_ratio, total_debt, inventory, trade_payables
    computed from the stored BS hierarchy.
    """
    bs = _load_bs_data(db)
    if bs is None:
        return {"available": False, "available_periods": []}

    available_periods = bs.get("available_periods", [])
    kpis              = bs.get("kpis", {})
    assets_breakdown  = bs.get("assets_breakdown", [])
    liabilities_breakdown = bs.get("liabilities_breakdown", [])
    capital_structure = bs.get("capital_structure", {})

    # Always return full unfiltered trend — frontend selects period client-side
    monthly_trend = sorted(
        bs.get("monthly_trend", []),
        key=lambda e: e["year"] * 100 + e["month"],
    )

    # Enrich each trend entry with fields derivable from BS hierarchy
    # (current_ratio, total_debt, inventory, trade_payables)
    hierarchy = bs.get("bs_hierarchy", [])
    if hierarchy:
        # Build a quick code->row lookup for speed
        code_map = {row["code"]: row for row in hierarchy if row.get("code") is not None}

        def _bv(code, ym):
            row = code_map.get(code)
            return float(row["values"].get(ym, 0)) if row else 0.0

        for entry in monthly_trend:
            ym = f"{entry['year']}-{entry['month']:02d}"
            ca = entry.get("current_assets", 0) or 0
            cl = entry.get("current_liabilities", 0) or 0
            entry["current_ratio"]   = round(ca / cl, 4) if cl else 0.0
            entry["total_debt"]      = round(_bv(320, ym) + _bv(338, ym), 2)
            entry["inventory"]       = round(_bv(141, ym), 2)
            entry["trade_payables"]  = round(_bv(311, ym), 2)

    return {
        "available": True,
        "available_periods": available_periods,
        "kpis": kpis,
        "monthly_trend": monthly_trend,
        "assets_breakdown": assets_breakdown,
        "liabilities_breakdown": liabilities_breakdown,
        "capital_structure": capital_structure,
    }


# ── GET /data/bs-statement ────────────────────────────────────────────────────

@router.get("/bs-statement")
async def get_bs_statement(
    year: Optional[int] = Query(None, description="Filter by year"),
    month: Optional[int] = Query(None, description="Filter by month 1-12"),
    year_from: Optional[int] = Query(None, description="Range start year"),
    month_from: Optional[int] = Query(None, description="Range start month 1-12"),
    year_to: Optional[int] = Query(None, description="Range end year"),
    month_to: Optional[int] = Query(None, description="Range end month 1-12"),
    compare_months: Optional[str] = Query(
        None, description="Comma-separated YYYY-MM list for multi-column compare"
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Balance Sheet statement view.
    Returns the full BS hierarchy with values for the requested period(s).

    Modes (determined from query params):
      single  – year + month  → value = current month, prior = previous month
      range   – year_from + year_to → value = sum over range months
      compare – compare_months CSV → one column per specified month
      year    – year only → 12 monthly columns for that calendar year
      all     – no params → all available months as columns
    """
    bs = _load_bs_data(db)
    if bs is None:
        return {"available": False, "available_periods": [], "hierarchy": []}

    available_periods = bs.get("available_periods", [])
    hierarchy = bs.get("bs_hierarchy", [])

    if not hierarchy:
        # Uploaded in month mode — bs_hierarchy not stored; return limited info
        return {
            "available": True,
            "available_periods": available_periods,
            "mode": "unavailable",
            "periods": [],
            "hierarchy": [],
            "note": "Full hierarchy not available. Re-upload with mode=full to enable statement view.",
        }

    # Build the set of all YYYY-MM keys present in the data
    all_months: list = sorted({
        f"{ap['year']}-{ap['month']:02d}" for ap in available_periods
    })

    # ── Determine mode and target periods ────────────────────────────────────
    if compare_months:
        mode = "compare"
        periods = [m.strip() for m in compare_months.split(",") if m.strip()]
        # Compute prior for each period (prior = previous calendar month)
        def _prior_key(ym: str) -> Optional[str]:
            yr, mo = int(ym[:4]), int(ym[5:])
            if mo == 1:
                pk = f"{yr - 1}-12"
            else:
                pk = f"{yr}-{mo - 1:02d}"
            return pk if pk in all_months else None

        prior_map = {p: _prior_key(p) for p in periods}

    elif year is not None and month is not None:
        mode = "single"
        period_str = f"{year}-{month:02d}"
        periods = [period_str]
        # Prior = previous calendar month
        if month == 1:
            prior_str = f"{year - 1}-12"
        else:
            prior_str = f"{year}-{month - 1:02d}"
        prior_map = {period_str: prior_str if prior_str in all_months else None}

    elif year_from is not None and year_to is not None:
        mode = "range"
        lo = year_from * 100 + (month_from or 1)
        hi = year_to * 100 + (month_to or 12)
        periods = [
            ym for ym in all_months
            if lo <= int(ym[:4]) * 100 + int(ym[5:]) <= hi
        ]
        prior_map = {}  # Range mode: no single prior

    elif year is not None:
        mode = "year"
        periods = [ym for ym in all_months if int(ym[:4]) == year]
        prior_map = {}  # Year mode: each column is its own month

    else:
        mode = "all"
        periods = all_months
        prior_map = {}

    # ── Build hierarchy response ──────────────────────────────────────────────
    def _get_val(row_values: dict, ym: str) -> float:
        return float(row_values.get(ym) or 0.0)

    output_hierarchy = []
    for row in hierarchy:
        row_values = row.get("values", {})

        if mode == "single":
            p = periods[0]
            val = _get_val(row_values, p)
            prior_key = prior_map.get(p)
            prior_val = _get_val(row_values, prior_key) if prior_key else 0.0
            output_hierarchy.append({
                "code": row["code"],
                "label": row["label"],
                "is_subtotal": row["is_subtotal"],
                "level": row["level"],
                "values": {p: val},
                "prior": {p: prior_val},
            })

        elif mode == "range":
            total = sum(_get_val(row_values, p) for p in periods)
            output_hierarchy.append({
                "code": row["code"],
                "label": row["label"],
                "is_subtotal": row["is_subtotal"],
                "level": row["level"],
                "values": {"range": total},
                "prior": {},
            })

        elif mode == "compare":
            vals = {p: _get_val(row_values, p) for p in periods}
            prior_vals = {
                p: _get_val(row_values, prior_map[p]) if prior_map.get(p) else 0.0
                for p in periods
            }
            output_hierarchy.append({
                "code": row["code"],
                "label": row["label"],
                "is_subtotal": row["is_subtotal"],
                "level": row["level"],
                "values": vals,
                "prior": prior_vals,
            })

        else:
            # year or all: one column per period
            vals = {p: _get_val(row_values, p) for p in periods}
            output_hierarchy.append({
                "code": row["code"],
                "label": row["label"],
                "is_subtotal": row["is_subtotal"],
                "level": row["level"],
                "values": vals,
                "prior": {},
            })

    return {
        "available": True,
        "available_periods": available_periods,
        "mode": mode,
        "periods": periods,
        "hierarchy": output_hierarchy,
    }
