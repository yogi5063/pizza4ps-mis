"""
Excel parser for Pizza 4P's MIS files.
Handles Revenue and COGS Excel files (.xlsx / .xlsb).
"""

from __future__ import annotations

import logging
import math
import re
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

logger = logging.getLogger(__name__)

import re as _re

# ── Constants ─────────────────────────────────────────────────────────────────
EXCEL_EPOCH = date(1899, 12, 30)

REVENUE_SHEET_CANDIDATES = [
    "Revenue_Data",
    "Detail (Recalculate)_1st Jan",
    "Detail (Recalculate)_1st Mar",
]

COGS_SHEET_CANDIDATES = ["COGS_Report", "COGS Report"]

COGS_CATEGORY_FILTER = {"food", "alcohol drink", "non alcohol"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def excel_serial_to_date(val: Any) -> Optional[date]:
    """Convert an Excel serial date (integer or float) to a Python date."""
    try:
        return EXCEL_EPOCH + timedelta(days=int(float(val)))
    except (TypeError, ValueError):
        return None


def excel_frac_to_ist_hour(time_frac: Any) -> Optional[int]:
    """
    Convert an Excel time value to IST hour (0-23).
    Handles: float fraction (0-1), datetime.time, datetime.datetime.
    Excel stores time as UTC; add 5h30m for IST.
    """
    import datetime as _dt
    try:
        # Already a datetime.time or datetime.datetime — use directly (assumed local/store time, no IST shift)
        if isinstance(time_frac, _dt.datetime):
            return time_frac.hour
        if isinstance(time_frac, _dt.time):
            return time_frac.hour
        # Excel float fraction
        frac = float(time_frac)
        utc_minutes = frac * 24 * 60
        ist_minutes = utc_minutes + 330          # +5h 30m
        ist_minutes = ist_minutes % 1440         # wrap around midnight
        return int(ist_minutes // 60)
    except (TypeError, ValueError):
        return None


def _safe_float(val: Any, default: float = 0.0) -> float:
    try:
        result = float(val)
        return default if math.isnan(result) or math.isinf(result) else result
    except (TypeError, ValueError):
        return default


def _read_excel_sheet(
    file_path: str,
    sheet_name: str,
    header: Optional[int] = None,
    engine: Optional[str] = None,
) -> Optional[pd.DataFrame]:
    """Attempt to read a single sheet; returns None on failure."""
    kwargs: dict = {"sheet_name": sheet_name, "header": header}
    if engine:
        kwargs["engine"] = engine
    try:
        return pd.read_excel(file_path, **kwargs)
    except Exception as exc:
        logger.debug("Could not read sheet '%s' from %s: %s", sheet_name, file_path, exc)
        return None


def _detect_engine(file_path: str) -> str:
    suffix = Path(file_path).suffix.lower()
    return "pyxlsb" if suffix == ".xlsb" else "openpyxl"


def _get_sheet_names(file_path: str, engine: str) -> List[str]:
    try:
        xl = pd.ExcelFile(file_path, engine=engine)
        names = xl.sheet_names
        if names:
            return names
    except Exception:
        pass
    # Fallback: use pyxlsb directly for .xlsb files
    if engine == "pyxlsb":
        try:
            import pyxlsb
            with pyxlsb.open_workbook(file_path) as wb:
                return list(wb.sheets)
        except Exception:
            pass
    return []


# ── Revenue parser ────────────────────────────────────────────────────────────

def _find_column(df_columns: List[str], candidates: List[str]) -> Optional[str]:
    """Return the first matching column name from candidates (case-insensitive strip)."""
    col_map = {str(c).strip().lower(): c for c in df_columns}
    for cand in candidates:
        key = cand.strip().lower()
        if key in col_map:
            return col_map[key]
    return None


# Exact column name for net revenue (may contain newlines)
NET_REVENUE_CANDIDATES = [
    "Net amount\n[3]=[1] - [2]",
    "Net amount",
    "net amount",
]
DISCOUNT_CANDIDATES = [
    "Discount\n[2]",
    "Discount",
    "discount",
]
SERVICE_CHARGE_CANDIDATES = [
    "Service charge\n[4] = [3] x 10%",
    "Service charge",
    "service charge",
    "Service Charge",
]
GST_CANDIDATES = [
    "Total GST amount\n[7] = [5] + [6]",
    "Total GST amount",
    "total gst amount",
    "GST",
]
GST_RATE_CANDIDATES = [
    "GST Rate (POS)",
    "GST rate (POS)",
    "GST Rate",
    "gst rate",
]
INVOICE_TOTAL_CANDIDATES = [
    "Total amount\n[8] = [3] + [4] + [7]",
    "Total amount",
    "total amount",
]
CHECK_NO_CANDIDATES = [
    "check_no",
    "Check No",
    "check no",
    "CheckNo",
    "receipt_no",
    "Receipt No",
    "receipt no",
    "invoice_no",
    "Invoice No",
    "Bill No",
    "bill_no",
]


def parse_revenue_file(file_path: str, month_key: str) -> Dict[str, Any]:
    """
    Parse a Revenue Excel file and return a dict with:
    - transactions: list of dicts (one per Active row)
    - all_transactions: list including Cancelled rows
    - month_key: str
    - columns_found: dict of resolved column names
    """
    engine = _detect_engine(file_path)
    sheet_names = _get_sheet_names(file_path, engine)
    logger.info("Available sheets in %s: %s", file_path, sheet_names)

    raw_df: Optional[pd.DataFrame] = None
    used_sheet = None

    # 1. Exact known sheet names first (preserves behaviour for files that
    #    already parse, e.g. Jan '_1st Jan' / Feb '_1st Mar').
    for candidate in REVENUE_SHEET_CANDIDATES:
        # Also try case-insensitive match
        matched_sheet = next(
            (s for s in sheet_names if s.strip() == candidate), None
        )
        if matched_sheet is None:
            matched_sheet = next(
                (s for s in sheet_names if s.strip().lower() == candidate.lower()), None
            )
        if matched_sheet:
            df_try = _read_excel_sheet(file_path, matched_sheet, header=None, engine=engine)
            if df_try is not None and len(df_try) > 4:
                raw_df = df_try
                used_sheet = matched_sheet
                logger.info("Using sheet '%s'", used_sheet)
                break

    # 2. Fallback: any "Detail (Recalculate)*" sheet. Month-to-month the suffix
    #    varies (recalc date), so match by prefix. Prefer a non-draft/copy sheet
    #    (e.g. Aug has a fuller '_09 Sep' final vs a '_Draft 01 A').
    if raw_df is None:
        detail = [s for s in sheet_names
                  if _re.match(r"detail \(recalculate\)", s.strip(), _re.I)]
        non_draft = [s for s in detail if not _re.search(r"draft|copy", s, _re.I)]
        for matched_sheet in (non_draft or detail):
            df_try = _read_excel_sheet(file_path, matched_sheet, header=None, engine=engine)
            if df_try is not None and len(df_try) > 4:
                raw_df = df_try
                used_sheet = matched_sheet
                logger.info("Using fallback detail sheet '%s'", used_sheet)
                break

    if raw_df is None:
        raise ValueError(
            f"No suitable revenue sheet found in {file_path}. "
            f"Available: {sheet_names}"
        )

    # The header row position drifts across months (index 1, 2 or 3). Detect it
    # by finding the first of the top rows that contains the "Net amount" column;
    # data starts on the following row. Fall back to index 2 (original default).
    header_idx = 2
    for i in range(min(6, len(raw_df))):
        row_vals = [str(v).strip().lower() for v in raw_df.iloc[i].tolist()
                    if pd.notna(v)]
        if any("net amount" in v for v in row_vals):
            header_idx = i
            break
    logger.info("Detected header row at index %d", header_idx)

    header_row = raw_df.iloc[header_idx].tolist()
    data_rows = raw_df.iloc[header_idx + 1:].reset_index(drop=True)
    # Some months repeat a header label (e.g. 'check_no' twice). Duplicate
    # column labels make row[col] return a Series -> "truth value ambiguous".
    # De-duplicate so every label is unique (first keeps its name).
    _seen: Dict[str, int] = {}
    _cols = []
    for i, h in enumerate(header_row):
        name = str(h).strip() if pd.notna(h) else f"_col{i}"
        if name in _seen:
            _seen[name] += 1
            name = f"{name}_{_seen[name]}"
        else:
            _seen[name] = 0
        _cols.append(name)
    data_rows.columns = _cols

    cols = list(data_rows.columns)

    # Resolve column names
    def resolve(candidates_list: List[str]) -> Optional[str]:
        return _find_column(cols, candidates_list)

    col_nr = resolve(NET_REVENUE_CANDIDATES)
    col_disc = resolve(DISCOUNT_CANDIDATES)
    col_sc = resolve(SERVICE_CHARGE_CANDIDATES)
    col_gst = resolve(GST_CANDIDATES)
    col_gst_rate = resolve(GST_RATE_CANDIDATES)
    col_inv_total = resolve(INVOICE_TOTAL_CANDIDATES)
    col_check_no = resolve(CHECK_NO_CANDIDATES)

    # Core dimension columns (try lowercase variants too)
    def resolve_dim(names: List[str]) -> Optional[str]:
        return _find_column(cols, names)

    col_item = resolve_dim(["item_name", "Item Name", "Item_Name", "Item"])
    col_cat = resolve_dim(["category_name", "Category Name", "Category_Name", "Category"])
    col_cls = resolve_dim(["class_name", "Class Name", "Class_Name", "Class"])
    col_channel = resolve_dim(["order_channel", "Order Channel", "Order_Channel", "Channel", "order channel"])
    col_table_type = resolve_dim(["table_type", "Table Type", "Table_Type"])
    col_table_name = resolve_dim(["table_name", "Table Name", "Table_Name", "Table"])
    col_status = resolve_dim(["Status", "status"])
    col_qty = resolve_dim(["quantity", "Quantity", "Qty", "qty"])
    col_date = resolve_dim(["date", "Date", "Order Date", "order_date"])
    col_order_time = resolve_dim(["order_time", "Order Time", "OrderTime", "order time"])

    logger.info(
        "Revenue columns resolved: nr=%s disc=%s sc=%s gst=%s status=%s date=%s time=%s",
        col_nr, col_disc, col_sc, col_gst, col_status, col_date, col_order_time,
    )

    transactions: List[dict] = []
    all_transactions: List[dict] = []

    for _, row in data_rows.iterrows():
        # Skip completely empty rows
        if all(pd.isna(v) for v in row.values):
            continue

        status_val = str(row[col_status]).strip() if col_status and pd.notna(row.get(col_status)) else "Active"

        # Parse date
        raw_date = row[col_date] if col_date else None
        parsed_date = None
        if raw_date is not None and pd.notna(raw_date):
            if isinstance(raw_date, (int, float)):
                parsed_date = excel_serial_to_date(raw_date)
            else:
                try:
                    parsed_date = pd.to_datetime(raw_date).date()
                except Exception:
                    parsed_date = excel_serial_to_date(raw_date)

        # Parse order_time → IST hour
        raw_time = row[col_order_time] if col_order_time else None
        ist_hour = None
        if raw_time is not None and pd.notna(raw_time):
            ist_hour = excel_frac_to_ist_hour(raw_time)

        # Numeric values
        nr = _safe_float(row[col_nr] if col_nr else 0)
        disc = _safe_float(row[col_disc] if col_disc else 0)
        sc = _safe_float(row[col_sc] if col_sc else 0)
        gst = _safe_float(row[col_gst] if col_gst else 0)
        gst_rate = _safe_float(row[col_gst_rate] if col_gst_rate else 0)
        inv_total = _safe_float(row[col_inv_total] if col_inv_total else 0)
        qty = _safe_float(row[col_qty] if col_qty else 0)

        # Dimension strings
        item_name = str(row[col_item]).strip() if col_item and pd.notna(row.get(col_item)) else ""
        category = str(row[col_cat]).strip() if col_cat and pd.notna(row.get(col_cat)) else ""
        cls = str(row[col_cls]).strip() if col_cls and pd.notna(row.get(col_cls)) else ""
        channel = str(row[col_channel]).strip() if col_channel and pd.notna(row.get(col_channel)) else ""
        table_type = str(row[col_table_type]).strip() if col_table_type and pd.notna(row.get(col_table_type)) else ""
        table_name = str(row[col_table_name]).strip() if col_table_name and pd.notna(row.get(col_table_name)) else ""
        check_no = str(row[col_check_no]).strip() if col_check_no and pd.notna(row.get(col_check_no)) else None

        tx = {
            "item_name": item_name,
            "category": category,
            "class": cls,
            "channel": channel,
            "table_type": table_type,
            "table_name": table_name,
            "status": status_val,
            "qty": qty,
            "date": str(parsed_date) if parsed_date else None,
            "ist_hour": ist_hour,
            "nr": nr,
            "disc": disc,
            "sc": sc,
            "gst": gst,
            "gst_rate": gst_rate,
            "inv_total": inv_total,
            "check_no": check_no,
            "month_key": month_key,
        }

        all_transactions.append(tx)
        if status_val.lower() == "active":
            transactions.append(tx)

    logger.info(
        "Revenue parsed: %d active rows, %d total rows from sheet '%s'",
        len(transactions), len(all_transactions), used_sheet,
    )

    return {
        "transactions": transactions,
        "all_transactions": all_transactions,
        "month_key": month_key,
        "sheet_used": used_sheet,
        "columns_found": {
            "net_revenue": col_nr,
            "discount": col_disc,
            "service_charge": col_sc,
            "gst": col_gst,
            "check_no": col_check_no,
        },
    }


# ── COGS parser ───────────────────────────────────────────────────────────────

def parse_cogs_file(
    file_path: str,
    month_key: str,
    net_revenue: float = 0.0,
    service_charge: float = 0.0,
) -> Dict[str, Any]:
    """
    Parse a COGS Excel file.
    Returns a dict with COGS summary metrics and ingredient-level data.
    """
    engine = _detect_engine(file_path)
    sheet_names = _get_sheet_names(file_path, engine)
    logger.info("COGS file sheets: %s", sheet_names)

    # ── Find and load main COGS sheet ──────────────────────────────────────────
    raw_df: Optional[pd.DataFrame] = None
    used_sheet = None

    for candidate in COGS_SHEET_CANDIDATES:
        matched = next((s for s in sheet_names if s.strip() == candidate), None)
        if matched is None:
            matched = next(
                (s for s in sheet_names if s.strip().lower() == candidate.lower()), None
            )
        if matched:
            df_try = _read_excel_sheet(file_path, matched, header=None, engine=engine)
            if df_try is not None and len(df_try) > 8:
                raw_df = df_try
                used_sheet = matched
                logger.info("COGS using sheet '%s'", used_sheet)
                break

    if raw_df is None:
        raise ValueError(
            f"No suitable COGS sheet found in {file_path}. Available: {sheet_names}"
        )

    # Grand total row is at index 4 (0-based)
    grand_total_row = raw_df.iloc[4]

    def _gt(col_idx: int) -> float:
        try:
            val = grand_total_row.iloc[col_idx]
            return _safe_float(val)
        except Exception:
            return 0.0

    # Header at index 6, data starts index 7
    header_row = raw_df.iloc[6].tolist()
    data_df = raw_df.iloc[7:].reset_index(drop=True).copy()

    # ── Filter by Category_2 (column index 1) ─────────────────────────────────
    # Col B = index 1
    try:
        cat2_col = data_df.iloc[:, 1]
        mask = cat2_col.apply(
            lambda v: str(v).strip().lower() in COGS_CATEGORY_FILTER
            if pd.notna(v) else False
        )
        filtered_df = data_df[mask].reset_index(drop=True)
    except Exception as exc:
        logger.warning("COGS category filter error: %s", exc)
        filtered_df = data_df

    def _sum_col(df: pd.DataFrame, col_idx: int) -> float:
        try:
            return df.iloc[:, col_idx].apply(_safe_float).sum()
        except Exception:
            return 0.0

    # ── Core COGS metrics ──────────────────────────────────────────────────────
    accounting_cog = _sum_col(filtered_df, 17)   # Col R = index 17
    standard_cog = _sum_col(filtered_df, 20)     # Col U = index 20

    # Adjustments from grand total row
    food_wastage = _gt(32)          # Col AG
    other_period_adj = _gt(28)      # Col AC
    training_adj = _gt(34)          # Col AI
    tasting_adj = _gt(36)           # Col AK
    gift_adj = _gt(40)              # Col AO

    total_adjustment = other_period_adj + training_adj + tasting_adj + gift_adj
    material_cog = accounting_cog - total_adjustment
    cog_variance = material_cog - standard_cog
    store_variance = cog_variance - food_wastage
    gross_margin = net_revenue - accounting_cog

    cog_pct_excl_sc = (accounting_cog / net_revenue) if net_revenue else 0.0
    cog_pct_incl_sc = (accounting_cog / (net_revenue + service_charge)) if (net_revenue + service_charge) else 0.0

    # ── Ingredient / group level data ──────────────────────────────────────────
    ingredients: List[dict] = []
    for _, row in filtered_df.iterrows():
        try:
            category_2 = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else ""
            group_item = str(row.iloc[2]).strip() if pd.notna(row.iloc[2]) else ""
            item_desc = str(row.iloc[5]).strip() if pd.notna(row.iloc[5]) else ""
            min_uom = str(row.iloc[6]).strip() if pd.notna(row.iloc[6]) else ""

            qty_ob = _safe_float(row.iloc[7])
            amt_ob = _safe_float(row.iloc[8])
            qty_purchase = _safe_float(row.iloc[9])
            amt_purchase = _safe_float(row.iloc[10])
            qty_closing = _safe_float(row.iloc[13])
            qty_actual = _safe_float(row.iloc[15])
            amt_actual = _safe_float(row.iloc[17])
            cog_std = _safe_float(row.iloc[20])

            # Adjustments per ingredient
            try:
                other_period_item = _safe_float(row.iloc[28])
            except Exception:
                other_period_item = 0.0
            try:
                wastage_item = _safe_float(row.iloc[32])
            except Exception:
                wastage_item = 0.0
            try:
                training_item = _safe_float(row.iloc[34])
            except Exception:
                training_item = 0.0
            try:
                tasting_item = _safe_float(row.iloc[36])
            except Exception:
                tasting_item = 0.0
            try:
                gift_item = _safe_float(row.iloc[40])
            except Exception:
                gift_item = 0.0

            if not item_desc and not group_item:
                continue

            ingredients.append({
                "category_2": category_2,
                "group_item": group_item,
                "item_description": item_desc,
                "min_uom": min_uom,
                "qty_ob": qty_ob,
                "amt_ob": amt_ob,
                "qty_purchase": qty_purchase,
                "amt_purchase": amt_purchase,
                "qty_closing": qty_closing,
                "qty_actual": qty_actual,
                "amt_actual": amt_actual,
                "cog_std": cog_std,
                "other_period": other_period_item,
                "food_wastage": wastage_item,
                "training": training_item,
                "tasting": tasting_item,
                "gift": gift_item,
            })
        except Exception as exc:
            logger.debug("Skipping COGS row due to error: %s", exc)
            continue

    # ── Cost Decomposition sheet (menu engineering) ────────────────────────────
    menu_engineering: List[dict] = []
    cost_decomp_sheet = next(
        (s for s in sheet_names
         if "cost decomp" in s.lower() or "cost_decomp" in s.lower()),
        None,
    )
    if cost_decomp_sheet:
        cd_raw = _read_excel_sheet(file_path, cost_decomp_sheet, header=None, engine=engine)
        if cd_raw is not None and len(cd_raw) > 6:
            cd_header = cd_raw.iloc[5].tolist()
            cd_data = cd_raw.iloc[6:].reset_index(drop=True)
            cd_data.columns = [
                str(h).strip() if pd.notna(h) else f"_col{i}"
                for i, h in enumerate(cd_header)
            ]
            for _, row in cd_data.iterrows():
                if all(pd.isna(v) for v in row.values):
                    continue
                rec = {str(k): (None if pd.isna(v) else v) for k, v in row.items()}
                menu_engineering.append(rec)

    # ── Exploded_Parent sheet (theoretical consumption) ────────────────────────
    exploded_parent: List[dict] = []
    ep_sheet = next(
        (s for s in sheet_names
         if "exploded" in s.lower() or "exploded_parent" in s.lower()),
        None,
    )
    if ep_sheet:
        ep_raw = _read_excel_sheet(file_path, ep_sheet, header=0, engine=engine)
        if ep_raw is not None:
            for _, row in ep_raw.iterrows():
                if all(pd.isna(v) for v in row.values):
                    continue
                rec = {str(k): (None if pd.isna(v) else v) for k, v in row.items()}
                exploded_parent.append(rec)

    summary = {
        "month_key": month_key,
        "accounting_cog": accounting_cog,
        "standard_cog": standard_cog,
        "food_wastage": food_wastage,
        "other_period_adj": other_period_adj,
        "training_adj": training_adj,
        "tasting_adj": tasting_adj,
        "gift_adj": gift_adj,
        "total_adjustment": total_adjustment,
        "material_cog": material_cog,
        "cog_variance": cog_variance,
        "store_variance": store_variance,
        "gross_margin": gross_margin,
        "net_revenue": net_revenue,
        "service_charge": service_charge,
        "cog_pct_excl_sc": cog_pct_excl_sc,
        "cog_pct_incl_sc": cog_pct_incl_sc,
        "sheet_used": used_sheet,
    }

    logger.info("COGS parsed: accounting=%.2f standard=%.2f variance=%.2f",
                accounting_cog, standard_cog, cog_variance)

    return {
        "summary": summary,
        "ingredients": ingredients,
        "menu_engineering": menu_engineering,
        "exploded_parent": exploded_parent,
    }


# ── P&L parser ────────────────────────────────────────────────────────────────

def _read_xlsb_sheet_raw(file_path: str, sheet_name: str) -> Optional[pd.DataFrame]:
    """Read a sheet from an .xlsb file using pyxlsb directly (bypasses pandas)."""
    try:
        import pyxlsb
        rows = []
        with pyxlsb.open_workbook(file_path) as wb:
            with wb.get_sheet(sheet_name) as ws:
                for row in ws.rows():
                    rows.append([c.v for c in row])
        if not rows:
            return None
        max_cols = max(len(r) for r in rows)
        padded = [r + [None] * (max_cols - len(r)) for r in rows]
        return pd.DataFrame(padded)
    except Exception as exc:
        logger.debug("pyxlsb direct read failed for '%s': %s", sheet_name, exc)
        return None


def _parse_pivot_data(file_path: str, engine: str, sheet_names: List[str]) -> Dict[str, Any]:
    """
    Extract the category breakdown table from the PivotData sheet.
    Structure:
      Row 2: Headers — col 4='Dine-in label' col 5=Revenue col 6=COGS col 7=GP col 8=GP%
      Rows 3-5: Category rows (label at col 0 or 4, values at cols 5-8 in Lakhs)
      Row 7: Grand total row (no label, values at cols 5-8 in Lakhs)
    Values are in Lakhs — multiply by 100,000 for actual rupees.
    Also extracts monthly trend from rows ~20-30 (Apr..latest month).
    """
    pivot_sheet = next((s for s in sheet_names if s.strip() == "PivotData"), None)
    if pivot_sheet is None:
        return {}

    suffix = Path(file_path).suffix.lower()
    try:
        if suffix == ".xlsb":
            df = _read_xlsb_sheet_raw(file_path, pivot_sheet)
        else:
            df = _read_excel_sheet(file_path, pivot_sheet, header=None, engine=engine)
    except Exception:
        return {}
    if df is None or len(df) < 8:
        return {}

    LAKH = 100_000.0

    def _cell(row_idx, col_idx):
        try:
            v = df.iloc[row_idx, col_idx]
            return v if v is not None else None
        except Exception:
            return None

    def _flt(v):
        try:
            f = float(v)
            return 0.0 if math.isnan(f) or math.isinf(f) else f
        except Exception:
            return 0.0

    # ── Category breakdown (rows 2-7, cols 4-8) ───────────────────────────────
    categories = []
    SKIP_LABELS = {"row labels", "grand total", "total", "", "none"}
    for r in range(2, min(10, len(df))):
        label_raw = _cell(r, 0) or _cell(r, 4)
        if label_raw is None:
            continue
        label = str(label_raw).strip()
        if label.lower() in SKIP_LABELS or not label:
            continue
        rev  = _flt(_cell(r, 5)) * LAKH
        cogs = _flt(_cell(r, 6)) * LAKH
        gp   = _flt(_cell(r, 7)) * LAKH
        gp_pct = _flt(_cell(r, 8))
        if rev == 0 and cogs == 0:
            continue
        categories.append({
            "category": label,
            "revenue": rev,
            "cogs": cogs,
            "gross_profit": gp,
            "gp_pct": gp_pct,
        })

    # Grand total row: find first row after the category rows that has no label but has values
    grand_total = None
    for r in range(5, min(12, len(df))):
        label_raw = _cell(r, 0) or _cell(r, 4)
        label = str(label_raw).strip() if label_raw is not None else ""
        if label.lower() in ("total", "grand total", ""):
            rev  = _flt(_cell(r, 5)) * LAKH
            cogs = _flt(_cell(r, 6)) * LAKH
            gp   = _flt(_cell(r, 7)) * LAKH
            gp_pct = _flt(_cell(r, 8))
            if rev > 0:
                grand_total = {"revenue": rev, "cogs": cogs, "gross_profit": gp, "gp_pct": gp_pct}
                break

    # ── Monthly trend (rows ~19+, cols 4-8) ──────────────────────────────────
    monthly_trend = []
    # Find the header row for monthly data
    header_row_idx = None
    for r in range(15, min(25, len(df))):
        v0 = str(_cell(r, 0) or "").strip().lower()
        v4 = str(_cell(r, 4) or "").strip().lower()
        if v0 == "row labels" or v4 == "month":
            header_row_idx = r
            break

    if header_row_idx is not None:
        for r in range(header_row_idx + 1, min(header_row_idx + 15, len(df))):
            label_raw = _cell(r, 4) or _cell(r, 0)
            if label_raw is None:
                continue
            label = str(label_raw).strip()
            if not label or label.lower() in SKIP_LABELS:
                continue
            rev  = _flt(_cell(r, 5)) * LAKH
            cogs = _flt(_cell(r, 6)) * LAKH
            gp   = _flt(_cell(r, 7)) * LAKH
            gp_pct = _flt(_cell(r, 8))
            if rev == 0:
                continue
            monthly_trend.append({
                "month_label": label,
                "revenue": rev,
                "cogs": cogs,
                "gross_profit": gp,
                "gp_pct": gp_pct,
            })

    logger.info("PivotData parsed: %d categories, %d monthly rows", len(categories), len(monthly_trend))
    return {
        "categories": categories,
        "grand_total": grand_total,
        "monthly_trend": monthly_trend,
    }


def parse_pnl_file(file_path: str, month_key: str) -> Dict[str, Any]:
    """
    Parse a P&L Excel/xlsb file from the 'PnL' sheet.
    Row 5 = headers, rows 6+ = data.
    Cols 3-6 = current month per store (BGL-IDN, BGL-BSC, IND-BO, TOTAL).
    Cols 9-12 = prior month per store.
    Returns hierarchy + per-store actuals + embedded prior month values.
    """
    engine = _detect_engine(file_path)
    sheet_names = _get_sheet_names(file_path, engine)
    logger.info("P&L file sheets: %s", sheet_names)

    pnl_sheet = next((s for s in sheet_names if s.strip() == "PnL"), None)
    if pnl_sheet is None:
        pnl_sheet = next((s for s in sheet_names if s.strip().lower() == "pnl"), None)
    if pnl_sheet is None:
        raise ValueError(f"No 'PnL' sheet found in {file_path}. Available: {sheet_names}")

    # Use pyxlsb direct reader for .xlsb files; fall back to pandas otherwise
    suffix = Path(file_path).suffix.lower()
    if suffix == ".xlsb":
        df = _read_xlsb_sheet_raw(file_path, pnl_sheet)
    else:
        df = _read_excel_sheet(file_path, pnl_sheet, header=None, engine=engine)
    if df is None or len(df) < 8:
        raise ValueError(f"PnL sheet is too small or unreadable in {file_path}")

    header_row = [str(v).strip() if v is not None else "" for v in df.iloc[5].tolist()]
    data_df = df.iloc[6:].reset_index(drop=True)

    # Store column indices: current = 3,4,5,6  |  prior = 9,10,11,12
    current_cols = [3, 4, 5, 6]
    prior_cols = [9, 10, 11, 12]

    store_names = []
    for i in current_cols:
        name = header_row[i] if i < len(header_row) else ""
        store_names.append(name if name and name not in ("None", "") else f"Store{i}")

    hierarchy: List[dict] = []
    actuals: Dict[str, Dict[str, float]] = {n: {} for n in store_names}
    prior_embedded: Dict[str, Dict[str, float]] = {n: {} for n in store_names}

    for _, row in data_df.iterrows():
        code_raw = row.iloc[0] if len(row) > 0 else None
        desc_raw = row.iloc[1] if len(row) > 1 else None
        sub_f_raw = row.iloc[2] if len(row) > 2 else None

        if code_raw is None or (isinstance(code_raw, float) and math.isnan(code_raw)):
            continue
        try:
            code = int(float(code_raw))
        except (TypeError, ValueError):
            continue

        description = str(desc_raw).strip() if desc_raw is not None else ""
        if not description or description in ("None", "nan"):
            continue

        try:
            sub_formula = int(float(sub_f_raw)) if sub_f_raw is not None else 0
        except (TypeError, ValueError):
            sub_formula = 0

        hierarchy.append({"code": code, "description": description, "sub_formula": sub_formula})

        for idx, store_name in enumerate(store_names):
            c_idx = current_cols[idx]
            p_idx = prior_cols[idx]
            actuals[store_name][str(code)] = _safe_float(
                row.iloc[c_idx] if c_idx < len(row) else None
            )
            prior_embedded[store_name][str(code)] = _safe_float(
                row.iloc[p_idx] if p_idx < len(row) else None
            )

    logger.info("P&L parsed: %d line items, stores=%s, month=%s",
                len(hierarchy), store_names, month_key)

    # ── Try to parse PivotData sheet for dashboard category breakdown ──────────
    pivot_breakdown = _parse_pivot_data(file_path, engine, sheet_names)

    return {
        "month_key": month_key,
        "hierarchy": hierarchy,
        "stores": store_names,
        "actuals": actuals,
        "prior_embedded": prior_embedded,
        "pivot_breakdown": pivot_breakdown,
    }


def parse_gl_india(file_path: str) -> Dict[str, Any]:
    """
    Parse the 'GL India' sheet from the P&L xlsb file.
    Reads 103k+ rows of raw GL data with pre-computed mapping columns AB-AS.
    Aggregates by: year × month × store × code_pnl × pnl_mapping × group_pnl
    Filters to Kind of acc = 'PL' rows only.
    Returns aggregated records + metadata.
    """
    engine = _detect_engine(file_path)
    sheet_names = _get_sheet_names(file_path, engine)

    gl_sheet = next((s for s in sheet_names if s.strip() == "GL India"), None)
    if gl_sheet is None:
        logger.warning("No 'GL India' sheet found in %s", file_path)
        return {}

    suffix = Path(file_path).suffix.lower()
    logger.info("Parsing GL India sheet from %s (this may take a moment)...", file_path)

    # Column indices (0-based)
    COL_MONTH   = 27   # AB — Month (1-12)
    COL_NET_AMT = 30   # AE — Net amount
    COL_CODE_PNL = 37  # AL — Code PnL
    COL_MAPPING = 38   # AM — PnL_Mapping
    COL_GROUP   = 39   # AN — Group PnL
    COL_STORE   = 40   # AO — Store name 2
    COL_KIND    = 42   # AQ — Kind of acc ('PL' or 'BS')
    COL_YEAR    = 43   # AR — Year
    COL_INR     = 44   # AS — INR amount

    # Category mapping: which Group PnL values go into which dashboard category
    DINE_IN_GROUPS = {"net revenue", "cost of sales", "cost of goods sold"}
    FIN_INCOME_GROUPS = {"financial income"}
    OTHER_INCOME_GROUPS = {"other income"}

    def _s(v) -> str:
        return str(v).strip() if v is not None else ""

    def _f(v) -> float:
        try:
            f = float(v)
            return 0.0 if math.isnan(f) or math.isinf(f) else f
        except Exception:
            return 0.0

    def _i(v):
        try:
            return int(float(v))
        except Exception:
            return None

    # Aggregation key: (year, month, store, code_pnl, pnl_mapping, group_pnl, category)
    agg: Dict[tuple, dict] = {}

    try:
        if suffix == ".xlsb":
            import pyxlsb
            with pyxlsb.open_workbook(file_path) as wb:
                with wb.get_sheet(gl_sheet) as ws:
                    for row_idx, row in enumerate(ws.rows()):
                        if row_idx == 0:
                            continue  # skip header
                        vals = [c.v for c in row]
                        if len(vals) <= COL_INR:
                            continue

                        kind = _s(vals[COL_KIND]).upper()
                        if kind != "PL":
                            continue

                        year  = _i(vals[COL_YEAR])
                        month = _i(vals[COL_MONTH])
                        if year is None or month is None:
                            continue

                        store     = _s(vals[COL_STORE]) or "Unknown"
                        code_pnl  = _i(vals[COL_CODE_PNL]) or 0
                        mapping   = _s(vals[COL_MAPPING])
                        group     = _s(vals[COL_GROUP])
                        net_amt   = _f(vals[COL_NET_AMT])
                        inr_amt   = _f(vals[COL_INR])

                        group_lower = group.lower()
                        if group_lower in DINE_IN_GROUPS:
                            category = "Dine-in"
                        elif group_lower in FIN_INCOME_GROUPS:
                            category = "Financial Income"
                        elif group_lower in OTHER_INCOME_GROUPS:
                            category = "Other Income"
                        else:
                            category = group  # keep other groups as-is

                        key = (year, month, store, code_pnl, mapping, group, category)
                        if key not in agg:
                            agg[key] = {"net_amt": 0.0, "inr_amt": 0.0}
                        agg[key]["net_amt"] += net_amt
                        agg[key]["inr_amt"] += inr_amt
        else:
            df = _read_excel_sheet(file_path, gl_sheet, header=0, engine=engine)
            if df is None:
                return {}
            cols = list(df.columns)
            for _, row in df.iterrows():
                def gc(idx):
                    return row.iloc[idx] if idx < len(row) else None
                kind = _s(gc(COL_KIND)).upper()
                if kind != "PL":
                    continue
                year  = _i(gc(COL_YEAR))
                month = _i(gc(COL_MONTH))
                if year is None or month is None:
                    continue
                store    = _s(gc(COL_STORE)) or "Unknown"
                code_pnl = _i(gc(COL_CODE_PNL)) or 0
                mapping  = _s(gc(COL_MAPPING))
                group    = _s(gc(COL_GROUP))
                net_amt  = _f(gc(COL_NET_AMT))
                inr_amt  = _f(gc(COL_INR))
                group_lower = group.lower()
                if group_lower in DINE_IN_GROUPS:
                    category = "Dine-in"
                elif group_lower in FIN_INCOME_GROUPS:
                    category = "Financial Income"
                elif group_lower in OTHER_INCOME_GROUPS:
                    category = "Other Income"
                else:
                    category = group
                key = (year, month, store, code_pnl, mapping, group, category)
                if key not in agg:
                    agg[key] = {"net_amt": 0.0, "inr_amt": 0.0}
                agg[key]["net_amt"] += net_amt
                agg[key]["inr_amt"] += inr_amt
    except Exception as exc:
        logger.error("GL India parsing failed: %s", exc)
        return {}

    # Build flat records list
    records = []
    for (year, month, store, code_pnl, mapping, group, category), totals in agg.items():
        records.append({
            "year": year,
            "month": month,
            "store": store,
            "code_pnl": code_pnl,
            "pnl_mapping": mapping,
            "group_pnl": group,
            "category": category,
            "net_amt": round(totals["net_amt"], 2),
            "inr_amt": round(totals["inr_amt"], 2),
        })

    # Derive unique values for metadata
    years  = sorted({r["year"]  for r in records})
    months = sorted({r["month"] for r in records})
    stores = sorted({r["store"] for r in records})
    groups = sorted({r["group_pnl"] for r in records})

    logger.info(
        "GL India parsed: %d aggregated records, years=%s, stores=%d",
        len(records), years, len(stores)
    )
    return {
        "records": records,
        "years": years,
        "months": months,
        "stores": stores,
        "groups": groups,
    }


def parse_pnl_budget_file(file_path: str) -> Dict[str, Any]:
    """
    Parse a P&L budget CSV/Excel file.
    Expected columns: Code PnL | Description | YYYY-MM | YYYY-MM | ...
    Returns: {month_key: {code_str: budget_value}}
    Budgets are stored under the 'TOTAL 4PS India' key for simplicity.
    """
    suffix = Path(file_path).suffix.lower()
    try:
        if suffix == ".csv":
            df = pd.read_csv(file_path, dtype=str)
        else:
            eng = _detect_engine(file_path)
            df = pd.read_excel(file_path, engine=eng, dtype=str)
    except Exception as exc:
        raise ValueError(f"Could not read budget file {file_path}: {exc}")

    month_pattern = _re.compile(r"^\d{4}-\d{2}$")
    month_cols = [c for c in df.columns if month_pattern.match(str(c).strip())]
    if not month_cols:
        raise ValueError("Budget file must have month columns in YYYY-MM format (e.g. 2026-01)")

    code_col = next(
        (c for c in df.columns if "code" in str(c).lower()), None
    )
    if code_col is None:
        raise ValueError("Budget file must have a column containing 'Code' in the header")

    result: Dict[str, Dict[str, float]] = {}
    for _, row in df.iterrows():
        code_raw = row[code_col]
        if code_raw is None or str(code_raw).strip() in ("", "nan", "None"):
            continue
        try:
            code = str(int(float(str(code_raw).strip())))
        except (TypeError, ValueError):
            continue

        for mk in month_cols:
            mk = str(mk).strip()
            val = _safe_float(row[mk])
            if mk not in result:
                result[mk] = {}
            result[mk][code] = val

    return result




# ══════════════════════════════════════════════════════════════════════════════
# BALANCE SHEET PARSER
# File: 1. 4PS_BS Report_2026_01.xlsb
# Sheets used: "BS" (full history) and "Dataworking" (current-month detail)
# ══════════════════════════════════════════════════════════════════════════════

def _safe_float(val) -> float:
    """Return float or 0.0 for None/non-numeric."""
    if val is None:
        return 0.0
    try:
        f = float(val)
        return 0.0 if (f != f) else f   # NaN guard
    except (TypeError, ValueError):
        return 0.0


def _excel_to_ym(serial) -> str:
    """Convert Excel serial date to 'YYYY-MM' string."""
    from datetime import datetime, timedelta
    try:
        dt = datetime(1899, 12, 30) + timedelta(days=int(float(serial)))
        return dt.strftime("%Y-%m")
    except Exception:
        return ""


def _bs_code_int(raw):
    """
    Normalise a raw BS-code cell value to int.
    Returns None for non-numeric codes like '411a'.
    """
    if raw is None:
        return None
    s = str(raw).strip()
    # Remove Excel float suffix (.0) as a unit, not char-by-char
    if s.endswith(".0"):
        s = s[:-2]
    try:
        return int(s)
    except ValueError:
        return None


def _code_level(code_int) -> int:
    """Derive hierarchy level from numeric BS code."""
    if code_int is None:
        return 2
    if code_int in (270, 440):
        return 0          # grand totals
    if code_int % 100 == 0:
        return 0          # section subtotals: 100, 200, 300, 400
    if code_int % 10 == 0:
        return 1          # group subtotals: 110, 120, 310, 330 …
    return 2              # detail lines: 111, 311, 421 …


def _is_liability_or_equity(code_int) -> bool:
    """Return True if BS code belongs to liabilities or equity (>= 300)."""
    return code_int is not None and code_int >= 300


def _parse_bs_sheet(wb):
    """
    Parse the BS sheet.

    Returns
    -------
    hierarchy : list of row-dicts with keys:
        code, label, is_subtotal, level, values (dict YYYY-MM -> float,
        sign-flipped for L/E so all values are positive magnitudes)
    month_col_map : dict YYYY-MM -> col_index
    """
    with wb.get_sheet("BS") as ws:
        rows = list(ws.rows())

    # Row index 5 is the header row: col0="BS code", col1="ITEMS", col2="Note", col3+= dates
    header = {c.c: c.v for c in rows[5]}

    # Build month -> column mapping (deduplicated).
    # Col 3  = 2024-03-31 (year-end value used for March 2024)
    # Cols 4, 5 = Jan 2024, Feb 2024
    # Cols 7-14 = Apr-Nov 2024 first set (skipped; prefer cols 16-23)
    # Col 15 = null spacer
    # Cols 16-38 = Apr 2024 to Jan 2026 (canonical monthly set)
    month_col_map = {}
    month_col_map["2024-01"] = 4
    month_col_map["2024-02"] = 5
    month_col_map["2024-03"] = 3          # YE value
    for col_idx in range(16, 39):
        val = header.get(col_idx)
        if isinstance(val, (int, float)) and val > 40000:
            ym = _excel_to_ym(val)
            if ym:
                month_col_map[ym] = col_idx

    sorted_months = sorted(month_col_map.keys())

    hierarchy = []
    for row in rows[7:]:          # data starts at row index 7
        d = {c.c: c.v for c in row}
        raw_code = d.get(0)
        if raw_code is None:
            continue
        code_int = _bs_code_int(raw_code)
        label = str(d.get(1) or "").strip()
        if not label:
            continue
        note = str(d.get(2) or "").strip()
        is_subtotal = (note.upper() == "Y")
        # The BS sheet stores ALL values as positive magnitudes (both assets and L/E).
        # No sign flip needed here; values are stored as-is.
        values = {}
        for ym in sorted_months:
            col = month_col_map[ym]
            v = _safe_float(d.get(col))
            values[ym] = v

        hierarchy.append({
            "code": code_int,
            "label": label,
            "is_subtotal": is_subtotal,
            "level": _code_level(code_int),
            "values": values,
        })

    return hierarchy, month_col_map


def _parse_dataworking_sheet(wb):
    """
    Parse Dataworking sheet for the most-recent period.

    Returns (code_sums, month_key, prev_month_key)
      code_sums  : dict str(bs_code) -> {"current": float, "previous": float}
      month_key  : "YYYY-MM" of the report month
      prev_month_key : "YYYY-MM" of the prior month
    """
    with wb.get_sheet("Dataworking") as ws:
        rows = list(ws.rows())

    # Month label -> calendar month number
    # Indian FY runs Apr-Mar; "10. Jan" = 10th month (Jan), "1. Apr" = 1st month (Apr)
    MONTH_NUMBER = {
        "1. Apr": 4,   "2. May": 5,   "3. Jun": 6,   "3. June": 6,
        "4. July": 7,  "4. Jul": 7,   "5. Aug": 8,   "5. Sep": 9,
        "6. June": 6,  "6. Sep": 9,   "7. July": 7,  "7. Oct": 10,
        "8. Aug": 8,   "8. Nov": 11,  "9. Dec": 12,  "9. Sep": 9,
        "10. Jan": 1,  "10. Oct": 10, "11. Feb": 2,  "11. Nov": 11,
        "12. Dec": 12, "12. Mar": 3,  "1. Jan": 1,   "2. Feb": 2,
        "3. Mar": 3,   "4. Apr": 4,   "5. May": 5,
    }

    def fy_month_to_ym(fy_raw, month_raw):
        month_str = str(month_raw or "").strip()
        fy_str = str(fy_raw or "").strip().replace(".0", "").strip()
        m = MONTH_NUMBER.get(month_str)
        if m is None:
            return None
        # Determine calendar year from FY label
        if fy_str in ("2026",):
            y = 2026
        elif fy_str == "2025-26":
            y = 2026 if m <= 3 else 2025
        elif fy_str in ("2025",):
            y = 2025
        elif fy_str == "2024-25":
            y = 2025 if m <= 3 else 2024
        elif fy_str in ("2024",):
            y = 2024
        else:
            try:
                y = int(fy_str)
            except Exception:
                return None
        return f"{y}-{m:02d}"

    # Collect all active-account rows with their resolved calendar YM
    resolved = []
    for row in rows[1:]:
        d = {c.c: c.v for c in row}
        active = str(d.get(0) or "").strip().lower()
        if "active" not in active:
            continue
        ym = fy_month_to_ym(d.get(15), d.get(14))
        if ym:
            resolved.append((ym, d))

    if not resolved:
        return {}, "", ""

    latest_ym = max(r[0] for r in resolved)

    # Compute previous month key
    yr, mo = int(latest_ym[:4]), int(latest_ym[5:])
    prev_ym = f"{yr-1}-12" if mo == 1 else f"{yr}-{mo-1:02d}"

    # Deduplicate: the Dataworking sheet stores the same data under multiple FY labels
    # (e.g. FY="2025-26"/month="10. Jan" AND FY=2026.0/month="1. Jan" both = 2026-01).
    # To avoid double-counting, we identify the unique (fy_raw, month_raw) source pairs
    # that map to latest_ym and keep only the FIRST one encountered.
    seen_sources = set()           # set of (fy_raw, month_raw) already counted
    chosen_source = None           # the canonical (fy_raw, month_raw) for latest_ym
    for ym, d in resolved:
        if ym != latest_ym:
            continue
        src = (str(d.get(15)), str(d.get(14)))
        seen_sources.add(src)
    # Pick the numeric FY source if available (e.g. "2026.0"), else first found
    canonical_src = None
    for src in seen_sources:
        try:
            float(src[0])           # numeric FY like "2026.0"
            canonical_src = src
            break
        except ValueError:
            pass
    if canonical_src is None and seen_sources:
        canonical_src = next(iter(seen_sources))

    # Sum current and previous by BS code for the latest period (canonical source only)
    from collections import defaultdict
    code_sums = defaultdict(lambda: {"current": 0.0, "previous": 0.0})
    for ym, d in resolved:
        if ym != latest_ym:
            continue
        src = (str(d.get(15)), str(d.get(14)))
        if src != canonical_src:
            continue                # skip duplicate FY sources
        raw_code = d.get(4)
        if raw_code is None:
            continue
        # Normalise key: float "111.0" -> "111", strings like "411a" stay as-is
        key = str(raw_code).strip()
        if key.endswith(".0"):
            key = key[:-2]
        try:
            key = str(int(float(key)))
        except ValueError:
            pass
        code_sums[key]["current"] += _safe_float(d.get(11))
        code_sums[key]["previous"] += _safe_float(d.get(12))

    return dict(code_sums), latest_ym, prev_ym


def _subtotal_from_bs(hierarchy, target_code, period):
    """Pull a signed value for a specific BS code from the hierarchy for a given period."""
    for row in hierarchy:
        if row["code"] == target_code:
            return row["values"].get(period, 0.0)
    return 0.0


def _build_monthly_trend(hierarchy, sorted_months):
    """Build the monthly_trend list from the BS hierarchy (full history)."""
    MONTH_ABBR = {
        1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
        7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec",
    }
    trend = []
    for ym in sorted_months:
        yr, mo = int(ym[:4]), int(ym[5:])
        label = f"{MONTH_ABBR[mo]} {str(yr)[2:]}"

        def bv(code):
            return _subtotal_from_bs(hierarchy, code, ym)

        ca  = bv(100)
        nca = bv(200)
        ta  = bv(270)
        cl  = bv(310)
        ncl = bv(330)
        tl  = cl + ncl
        te  = bv(400)
        # Retained earnings (code 421) is stored as negative in the BS sheet
        # (accumulated deficit). Use as-is; spec says "keep negative".
        re_ = bv(421)

        trend.append({
            "year": yr,
            "month": mo,
            "month_label": label,
            "cash": bv(110),
            "working_capital": ca - cl,
            "total_assets": ta,
            "current_assets": ca,
            "non_current_assets": nca,
            "total_equity": te,
            "retained_earnings": re_,
            "current_liabilities": cl,
            "total_liabilities": tl,
        })
    return trend


def parse_bs_file(file_path: str, mode: str = "full") -> dict:
    """
    Parse the Pizza 4P's Balance Sheet Excel file (.xlsb).

    Parameters
    ----------
    file_path : str
        Absolute path to the .xlsb file.
    mode : str
        "full"  – includes bs_hierarchy (all rows with all monthly values).
        "month" – KPI-focused, but always returns monthly_trend and kpis.

    Returns
    -------
    dict conforming to the BS parser spec.
    """
    from pyxlsb import open_workbook

    result = {"mode": mode}

    with open_workbook(file_path) as wb:

        # ── 1. Parse BS sheet (always) ──────────────────────────────────────
        hierarchy, month_col_map = _parse_bs_sheet(wb)
        sorted_months = sorted(month_col_map.keys())

        result["available_periods"] = [
            {"year": int(ym[:4]), "month": int(ym[5:])}
            for ym in sorted_months
        ]
        result["monthly_trend"] = _build_monthly_trend(hierarchy, sorted_months)

        if mode == "full":
            result["bs_hierarchy"] = hierarchy

        # ── 2. Parse Dataworking sheet for current-month detail ─────────────
        code_sums, dw_month_key, prev_ym = _parse_dataworking_sheet(wb)

    # Use dw_month_key as the authoritative report month
    period_key = dw_month_key if dw_month_key else (sorted_months[-1] if sorted_months else "")
    prev_period_key = prev_ym if prev_ym in month_col_map else ""
    result["month_key"] = period_key

    def bv(code):
        """BS sheet subtotal for the report period (sign-flipped where appropriate)."""
        return _subtotal_from_bs(hierarchy, code, period_key)

    def bv_p(code):
        """BS sheet subtotal for the prior period."""
        return _subtotal_from_bs(hierarchy, code, prev_period_key) if prev_period_key else 0.0

    def dw(code_str, field="current"):
        """Raw sum from Dataworking for a given code string."""
        return _safe_float(code_sums.get(str(code_str), {}).get(field, 0.0))

    # ── KPIs ──────────────────────────────────────────────────────────────
    # Cash: code 111 (Dataworking, raw positive for assets)
    cash       = dw("111")
    cash_prior = dw("111", "previous")

    # Inventory: code 141
    inventory       = dw("141")
    inventory_prior = dw("141", "previous")

    # Balance sheet subtotals (from BS sheet — more reliable than summing DW lines)
    current_assets           = bv(100)
    current_assets_prior     = bv_p(100)
    non_current_assets       = bv(200)
    non_current_assets_prior = bv_p(200)
    total_assets             = bv(270)
    total_assets_prior       = bv_p(270)

    # Liabilities and equity (sign already flipped in hierarchy → positive magnitudes)
    current_liabilities         = bv(310)
    current_liabilities_prior   = bv_p(310)
    non_current_liabilities     = bv(330)
    non_current_liabilities_prior = bv_p(330)
    total_liabilities         = current_liabilities + non_current_liabilities
    total_liabilities_prior   = current_liabilities_prior + non_current_liabilities_prior
    total_equity              = bv(400)
    total_equity_prior        = bv_p(400)

    # Trade payables: code 311 (Dataworking stores credit balances as negative → negate)
    trade_payables       = -dw("311")
    trade_payables_prior = -dw("311", "previous")

    # Debt: ST loans (code 320) + LT loans (code 338) from BS hierarchy (already positive)
    debt_st      = _subtotal_from_bs(hierarchy, 320, period_key)
    debt_lt      = _subtotal_from_bs(hierarchy, 338, period_key)
    total_debt   = debt_st + debt_lt
    debt_st_p    = _subtotal_from_bs(hierarchy, 320, prev_period_key) if prev_period_key else 0.0
    debt_lt_p    = _subtotal_from_bs(hierarchy, 338, prev_period_key) if prev_period_key else 0.0
    total_debt_prior = debt_st_p + debt_lt_p

    # Retained earnings: code 421 — BS sheet stores as negative (accumulated deficit).
    # No sign adjustment needed; spec says "keep negative".
    retained_earnings       = bv(421)
    retained_earnings_prior = bv_p(421)

    # Share capital: code 411 (from BS hierarchy, stored as positive)
    share_capital = bv(411)

    working_capital = current_assets - current_liabilities
    current_ratio   = round(current_assets / current_liabilities, 4) if current_liabilities else 0.0

    result["kpis"] = {
        "cash":                          cash,
        "cash_prior":                    cash_prior,
        "inventory":                     inventory,
        "inventory_prior":               inventory_prior,
        "current_assets":                current_assets,
        "current_assets_prior":          current_assets_prior,
        "non_current_assets":            non_current_assets,
        "non_current_assets_prior":      non_current_assets_prior,
        "total_assets":                  total_assets,
        "total_assets_prior":            total_assets_prior,
        "current_liabilities":           current_liabilities,
        "current_liabilities_prior":     current_liabilities_prior,
        "non_current_liabilities":       non_current_liabilities,
        "non_current_liabilities_prior": non_current_liabilities_prior,
        "total_liabilities":             total_liabilities,
        "total_equity":                  total_equity,
        "total_equity_prior":            total_equity_prior,
        "trade_payables":                trade_payables,
        "trade_payables_prior":          trade_payables_prior,
        "total_debt":                    total_debt,
        "total_debt_prior":              total_debt_prior,
        "retained_earnings":             retained_earnings,
        "share_capital":                 share_capital,
        "working_capital":               working_capital,
        "current_ratio":                 current_ratio,
    }

    # ── Assets breakdown ──────────────────────────────────────────────────
    recv_total = bv(130)     # Current account receivables group subtotal
    fa_total   = bv(220)     # Fixed assets group subtotal
    other      = total_assets - cash - inventory - recv_total - fa_total

    def pct(v, total):
        return round(v / total, 4) if total else 0.0

    result["assets_breakdown"] = [
        {"label": "Cash & Equivalents", "value": cash,       "pct": pct(cash, total_assets)},
        {"label": "Inventory",           "value": inventory,  "pct": pct(inventory, total_assets)},
        {"label": "Receivables",         "value": recv_total, "pct": pct(recv_total, total_assets)},
        {"label": "Fixed Assets",        "value": fa_total,   "pct": pct(fa_total, total_assets)},
        {"label": "Other",               "value": other,      "pct": pct(other, total_assets)},
    ]

    # ── Liabilities breakdown ─────────────────────────────────────────────
    stat_ob      = bv(313)   # Statutory obligations
    emp_pay      = bv(314)   # Payables to employees
    loans_leases = total_debt
    other_liab   = total_liabilities - trade_payables - stat_ob - emp_pay - loans_leases

    result["liabilities_breakdown"] = [
        {"label": "Trade Payables",         "value": trade_payables,  "pct": pct(trade_payables, total_liabilities)},
        {"label": "Statutory Obligations",  "value": stat_ob,         "pct": pct(stat_ob, total_liabilities)},
        {"label": "Employee Payables",      "value": emp_pay,         "pct": pct(emp_pay, total_liabilities)},
        {"label": "Loans & Finance Leases", "value": loans_leases,    "pct": pct(loans_leases, total_liabilities)},
        {"label": "Other",                  "value": other_liab,      "pct": pct(other_liab, total_liabilities)},
    ]

    # ── Capital structure ─────────────────────────────────────────────────
    result["capital_structure"] = {
        "total_assets":      total_assets,
        "total_liabilities": total_liabilities,
        "total_equity":      total_equity,
    }

    return result
