"""
Aggregator service for Pizza 4P's MIS.
Takes a list of revenue transactions and builds all data cubes.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Restaurant valid hours (IST)
VALID_HOURS = set(range(11, 24))  # 11:00 – 23:59

DOW_NAMES = {
    0: "Monday",
    1: "Tuesday",
    2: "Wednesday",
    3: "Thursday",
    4: "Friday",
    5: "Saturday",
    6: "Sunday",
}


def _dow(date_str: Optional[str]) -> Optional[int]:
    """Return weekday integer (0=Mon … 6=Sun) from 'YYYY-MM-DD' string."""
    if not date_str:
        return None
    try:
        from datetime import date
        d = date.fromisoformat(date_str)
        return d.weekday()
    except Exception:
        return None


def _invoice_key(tx: dict) -> str:
    """
    Generate a surrogate invoice key for grouping.
    Prefer check_no if available; otherwise group by date|hour|table|channel.
    """
    if tx.get("check_no") and tx["check_no"] not in ("None", "", "nan"):
        return str(tx["check_no"])
    return f"{tx.get('date')}|{tx.get('ist_hour')}|{tx.get('table_name')}|{tx.get('channel')}"


def build_cubes(transactions: List[dict], month_key: str) -> Dict[str, Any]:
    """
    Build all 11 data cubes from a list of Active transaction dicts.

    Returns a dict with keys:
      kpi, daily, hr_sum, cat_ch, dow_hr, table_hr, items,
      disc_ch, canc_hr, gst_slab, top_invoices
    """

    # ── 1. KPI cube ───────────────────────────────────────────────────────────
    kpi_acc: dict = {
        "nr": 0.0, "disc": 0.0, "sc": 0.0, "gst": 0.0,
        "qty": 0.0, "gross_rev": 0.0,
    }
    invoice_set: set = set()

    # ── 2. Daily cube ─────────────────────────────────────────────────────────
    # daily[date_str] = {nr, disc, sc, gst, qty, inv_count, dow}
    daily_acc: Dict[str, dict] = defaultdict(lambda: {
        "nr": 0.0, "disc": 0.0, "sc": 0.0, "gst": 0.0,
        "qty": 0.0, "invoices": set(), "dow": None,
    })

    # ── 3. Hourly sum cube ────────────────────────────────────────────────────
    hr_acc: Dict[int, dict] = defaultdict(lambda: {
        "nr": 0.0, "qty": 0.0, "invoices": set(),
    })

    # ── 4. Category × Channel cube ────────────────────────────────────────────
    cat_ch_acc: Dict[str, dict] = defaultdict(lambda: {"nr": 0.0, "qty": 0.0})

    # ── 5. DOW × Hour heatmap ─────────────────────────────────────────────────
    dow_hr_acc: Dict[str, dict] = defaultdict(lambda: {"nr": 0.0, "qty": 0.0})

    # ── 6. Table × Hour cube ──────────────────────────────────────────────────
    table_hr_acc: Dict[str, dict] = defaultdict(lambda: {"nr": 0.0, "qty": 0.0})

    # ── 7. Items cube ─────────────────────────────────────────────────────────
    items_acc: Dict[str, dict] = defaultdict(lambda: {
        "nr": 0.0, "qty": 0.0, "disc": 0.0, "sc": 0.0,
        "cat": "", "cls": "", "price_sum": 0.0, "price_count": 0,
    })

    # ── 8. Discount × Channel ─────────────────────────────────────────────────
    disc_ch_acc: Dict[str, dict] = defaultdict(lambda: {"disc": 0.0, "nr": 0.0})

    # ── 10. GST slab ──────────────────────────────────────────────────────────
    gst_slab_acc: Dict[str, dict] = defaultdict(lambda: {"nr": 0.0, "gst": 0.0, "qty": 0.0})

    # ── 11. Top invoices accumulator ─────────────────────────────────────────
    inv_nr_acc: Dict[str, dict] = defaultdict(lambda: {
        "nr": 0.0, "disc": 0.0, "sc": 0.0, "gst": 0.0,
        "date": None, "ist_hour": None, "table": None, "channel": None,
    })

    for tx in transactions:
        nr = tx.get("nr", 0.0)
        disc = tx.get("disc", 0.0)
        sc = tx.get("sc", 0.0)
        gst = tx.get("gst", 0.0)
        qty = tx.get("qty", 0.0)
        gst_rate = tx.get("gst_rate", 0.0)
        date_str = tx.get("date")
        ist_hour = tx.get("ist_hour")
        channel = tx.get("channel", "")
        category = tx.get("category", "")
        item_name = tx.get("item_name", "")
        cls = tx.get("class", "")
        table_name = tx.get("table_name", "")
        inv_key = _invoice_key(tx)
        dow = _dow(date_str)

        gross_rev = nr + disc  # gross before discount

        # ── KPI ───────────────────────────────────────────────────────────────
        kpi_acc["nr"] += nr
        kpi_acc["disc"] += disc
        kpi_acc["sc"] += sc
        kpi_acc["gst"] += gst
        kpi_acc["qty"] += qty
        kpi_acc["gross_rev"] += gross_rev
        invoice_set.add(inv_key)

        # ── Daily ─────────────────────────────────────────────────────────────
        if date_str:
            d = daily_acc[date_str]
            d["nr"] += nr
            d["disc"] += disc
            d["sc"] += sc
            d["gst"] += gst
            d["qty"] += qty
            d["invoices"].add(inv_key)
            if d["dow"] is None and dow is not None:
                d["dow"] = dow

        # ── Hourly ────────────────────────────────────────────────────────────
        if ist_hour is not None and ist_hour in VALID_HOURS:
            h = hr_acc[ist_hour]
            h["nr"] += nr
            h["qty"] += qty
            h["invoices"].add(inv_key)

        # ── Category × Channel ────────────────────────────────────────────────
        cc_key = f"{category}|{channel}"
        cat_ch_acc[cc_key]["nr"] += nr
        cat_ch_acc[cc_key]["qty"] += qty

        # ── DOW × Hour ────────────────────────────────────────────────────────
        if dow is not None and ist_hour is not None and ist_hour in VALID_HOURS:
            dh_key = f"{dow}|{ist_hour}"
            dow_hr_acc[dh_key]["nr"] += nr
            dow_hr_acc[dh_key]["qty"] += qty

        # ── Table × Hour ──────────────────────────────────────────────────────
        if table_name and ist_hour is not None and ist_hour in VALID_HOURS:
            th_key = f"{table_name}|{ist_hour}"
            table_hr_acc[th_key]["nr"] += nr
            table_hr_acc[th_key]["qty"] += qty

        # ── Items ─────────────────────────────────────────────────────────────
        if item_name:
            it = items_acc[item_name]
            it["nr"] += nr
            it["qty"] += qty
            it["disc"] += disc
            it["sc"] += sc
            if not it["cat"]:
                it["cat"] = category
            if not it["cls"]:
                it["cls"] = cls
            if qty > 0:
                it["price_sum"] += nr
                it["price_count"] += 1

        # ── Discount × Channel ────────────────────────────────────────────────
        if channel:
            disc_ch_acc[channel]["disc"] += disc
            disc_ch_acc[channel]["nr"] += nr

        # ── GST slab ─────────────────────────────────────────────────────────
        slab_key = str(gst_rate)
        gst_slab_acc[slab_key]["nr"] += nr
        gst_slab_acc[slab_key]["gst"] += gst
        gst_slab_acc[slab_key]["qty"] += qty

        # ── Top invoices ──────────────────────────────────────────────────────
        iv = inv_nr_acc[inv_key]
        iv["nr"] += nr
        iv["disc"] += disc
        iv["sc"] += sc
        iv["gst"] += gst
        if iv["date"] is None:
            iv["date"] = date_str
            iv["ist_hour"] = ist_hour
            iv["table"] = table_name
            iv["channel"] = channel

    # ── 9. Cancellations by hour ──────────────────────────────────────────────
    # We need all_transactions for this – callers pass only active txs here.
    # canc_hr will be empty unless caller passes cancelled txs separately.
    # The router will call build_canc_cubes() with cancelled txs.
    canc_hr_acc: Dict[int, dict] = {}  # Populated by build_canc_cubes()

    # ── Finalise KPI ──────────────────────────────────────────────────────────
    inv_count = len(invoice_set)
    avg_bill = kpi_acc["nr"] / inv_count if inv_count else 0.0

    kpi_cube = {
        "month_key": month_key,
        "nr": round(kpi_acc["nr"], 2),
        "disc": round(kpi_acc["disc"], 2),
        "sc": round(kpi_acc["sc"], 2),
        "gst": round(kpi_acc["gst"], 2),
        "qty": round(kpi_acc["qty"], 2),
        "inv_count": inv_count,
        "avg_bill": round(avg_bill, 2),
        "gross_rev": round(kpi_acc["gross_rev"], 2),
        # canc_count and canc_value filled later via build_canc_cubes()
        "canc_count": 0,
        "canc_value": 0.0,
    }

    # ── Finalise Daily ────────────────────────────────────────────────────────
    daily_cube = {}
    for date_str, d in sorted(daily_acc.items()):
        daily_cube[date_str] = {
            "nr": round(d["nr"], 2),
            "disc": round(d["disc"], 2),
            "sc": round(d["sc"], 2),
            "gst": round(d["gst"], 2),
            "qty": round(d["qty"], 2),
            "inv_count": len(d["invoices"]),
            "dow": d["dow"],
            "dow_name": DOW_NAMES.get(d["dow"], "") if d["dow"] is not None else "",
        }

    # ── Finalise Hourly ───────────────────────────────────────────────────────
    hr_cube = {}
    for h in sorted(hr_acc.keys()):
        hr_cube[str(h)] = {
            "nr": round(hr_acc[h]["nr"], 2),
            "qty": round(hr_acc[h]["qty"], 2),
            "inv_count": len(hr_acc[h]["invoices"]),
        }

    # ── Finalise Category × Channel ───────────────────────────────────────────
    cat_ch_cube = {
        k: {"nr": round(v["nr"], 2), "qty": round(v["qty"], 2)}
        for k, v in sorted(cat_ch_acc.items(), key=lambda x: -x[1]["nr"])
    }

    # ── Finalise DOW × Hour ───────────────────────────────────────────────────
    dow_hr_cube = {
        k: {"nr": round(v["nr"], 2), "qty": round(v["qty"], 2)}
        for k, v in dow_hr_acc.items()
    }

    # ── Finalise Table × Hour ─────────────────────────────────────────────────
    table_hr_cube = {
        k: {"nr": round(v["nr"], 2), "qty": round(v["qty"], 2)}
        for k, v in table_hr_acc.items()
    }

    # ── Finalise Items ────────────────────────────────────────────────────────
    items_cube = {}
    for item, d in sorted(items_acc.items(), key=lambda x: -x[1]["nr"]):
        avg_price = d["price_sum"] / d["price_count"] if d["price_count"] else 0.0
        items_cube[item] = {
            "nr": round(d["nr"], 2),
            "qty": round(d["qty"], 2),
            "disc": round(d["disc"], 2),
            "sc": round(d["sc"], 2),
            "cat": d["cat"],
            "cls": d["cls"],
            "avg_price": round(avg_price, 2),
        }

    # ── Finalise Discount × Channel ───────────────────────────────────────────
    disc_ch_cube = {
        k: {"disc": round(v["disc"], 2), "nr": round(v["nr"], 2)}
        for k, v in sorted(disc_ch_acc.items(), key=lambda x: -x[1]["disc"])
    }

    # ── Finalise GST slab ─────────────────────────────────────────────────────
    gst_slab_cube = {
        k: {
            "nr": round(v["nr"], 2),
            "gst": round(v["gst"], 2),
            "qty": round(v["qty"], 2),
        }
        for k, v in sorted(gst_slab_acc.items())
    }

    # ── Finalise Top Invoices ─────────────────────────────────────────────────
    top_invoices = sorted(
        [
            {
                "inv_key": k,
                "nr": round(v["nr"], 2),
                "disc": round(v["disc"], 2),
                "sc": round(v["sc"], 2),
                "gst": round(v["gst"], 2),
                "date": v["date"],
                "ist_hour": v["ist_hour"],
                "table": v["table"],
                "channel": v["channel"],
            }
            for k, v in inv_nr_acc.items()
        ],
        key=lambda x: -x["nr"],
    )[:100]

    return {
        "kpi": kpi_cube,
        "daily": daily_cube,
        "hr_sum": hr_cube,
        "cat_ch": cat_ch_cube,
        "dow_hr": dow_hr_cube,
        "table_hr": table_hr_cube,
        "items": items_cube,
        "disc_ch": disc_ch_cube,
        "canc_hr": canc_hr_acc,
        "gst_slab": gst_slab_cube,
        "top_invoices": top_invoices,
    }


def build_canc_cubes(cancelled_transactions: List[dict]) -> Dict[str, Any]:
    """
    Build cancellation cube from cancelled (Status != Active) transactions.
    Returns:
      - canc_hr: {ist_hour: {count, nr}}
      - canc_ch: {channel: {count, nr}}
      - canc_count: int
      - canc_value: float
    """
    canc_hr_acc: Dict[int, dict] = defaultdict(lambda: {"count": 0, "nr": 0.0})
    canc_ch_acc: Dict[str, dict] = defaultdict(lambda: {"count": 0, "nr": 0.0})
    canc_count = 0
    canc_value = 0.0
    canc_inv_set: set = set()

    for tx in cancelled_transactions:
        nr = tx.get("nr", 0.0)
        ist_hour = tx.get("ist_hour")
        channel = tx.get("channel", "Unknown") or "Unknown"
        inv_key = f"{tx.get('date')}|{tx.get('ist_hour')}|{tx.get('table_name')}|{channel}"

        canc_value += abs(nr)
        canc_inv_set.add(inv_key)

        if ist_hour is not None and ist_hour in VALID_HOURS:
            canc_hr_acc[ist_hour]["count"] += 1
            canc_hr_acc[ist_hour]["nr"] += abs(nr)

        canc_ch_acc[channel]["count"] += 1
        canc_ch_acc[channel]["nr"] += abs(nr)

    canc_count = len(canc_inv_set)

    canc_hr_cube = {
        str(h): {"count": v["count"], "nr": round(v["nr"], 2)}
        for h, v in sorted(canc_hr_acc.items())
    }
    canc_ch_cube = {
        ch: {"count": v["count"], "nr": round(v["nr"], 2)}
        for ch, v in sorted(canc_ch_acc.items(), key=lambda x: -x[1]["nr"])
    }

    return {
        "canc_hr": canc_hr_cube,
        "canc_ch": canc_ch_cube,
        "canc_count": canc_count,
        "canc_value": round(canc_value, 2),
    }


def merge_cubes(cubes_list: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Merge multiple monthly cubes into one for multi-month queries.
    """
    if not cubes_list:
        return {}
    if len(cubes_list) == 1:
        return cubes_list[0]

    merged: Dict[str, Any] = {}

    # ── KPI: sum numeric fields ────────────────────────────────────────────────
    numeric_kpi = ["nr", "disc", "sc", "gst", "qty", "gross_rev", "canc_value"]
    kpi_m: dict = {k: 0.0 for k in numeric_kpi}
    kpi_m["inv_count"] = 0
    kpi_m["canc_count"] = 0
    kpi_m["month_key"] = ",".join(c.get("kpi", {}).get("month_key", "") for c in cubes_list)

    for c in cubes_list:
        kpi = c.get("kpi", {})
        for k in numeric_kpi:
            kpi_m[k] += kpi.get(k, 0.0)
        kpi_m["inv_count"] += kpi.get("inv_count", 0)
        kpi_m["canc_count"] += kpi.get("canc_count", 0)

    total_inv = kpi_m["inv_count"]
    kpi_m["avg_bill"] = round(kpi_m["nr"] / total_inv, 2) if total_inv else 0.0
    for k in numeric_kpi:
        kpi_m[k] = round(kpi_m[k], 2)
    merged["kpi"] = kpi_m

    # ── Daily: union dates, sum numeric ───────────────────────────────────────
    daily_m: Dict[str, dict] = {}
    for c in cubes_list:
        for date_str, dv in c.get("daily", {}).items():
            if date_str not in daily_m:
                daily_m[date_str] = dict(dv)
            else:
                for k in ["nr", "disc", "sc", "gst", "qty", "inv_count"]:
                    daily_m[date_str][k] = daily_m[date_str].get(k, 0) + dv.get(k, 0)
    merged["daily"] = {k: daily_m[k] for k in sorted(daily_m.keys())}

    # ── Generic dict merger (sum numeric values) ───────────────────────────────
    def _merge_num_dict(key: str, num_fields: List[str]) -> dict:
        acc: Dict[str, dict] = {}
        for c in cubes_list:
            for k, v in c.get(key, {}).items():
                if k not in acc:
                    acc[k] = {f: 0.0 for f in num_fields}
                for f in num_fields:
                    acc[k][f] = round(acc[k].get(f, 0.0) + v.get(f, 0.0), 2)
        return acc

    merged["hr_sum"] = _merge_num_dict("hr_sum", ["nr", "qty", "inv_count"])
    merged["cat_ch"] = _merge_num_dict("cat_ch", ["nr", "qty"])
    merged["dow_hr"] = _merge_num_dict("dow_hr", ["nr", "qty"])
    merged["table_hr"] = _merge_num_dict("table_hr", ["nr", "qty"])
    merged["disc_ch"] = _merge_num_dict("disc_ch", ["disc", "nr"])
    merged["canc_hr"] = _merge_num_dict("canc_hr", ["count", "nr"])
    merged["canc_ch"] = _merge_num_dict("canc_ch", ["count", "nr"])
    merged["gst_slab"] = _merge_num_dict("gst_slab", ["nr", "gst", "qty"])

    # ── Items: merge with string fields preserved ──────────────────────────────
    items_m: Dict[str, dict] = {}
    for c in cubes_list:
        for item, v in c.get("items", {}).items():
            if item not in items_m:
                items_m[item] = dict(v)
                items_m[item]["_price_sum"] = v.get("avg_price", 0.0) * max(v.get("qty", 0), 1)
                items_m[item]["_price_count"] = max(v.get("qty", 0), 1)
            else:
                for f in ["nr", "qty", "disc", "sc"]:
                    items_m[item][f] = round(items_m[item].get(f, 0.0) + v.get(f, 0.0), 2)
                items_m[item]["_price_sum"] += v.get("avg_price", 0.0) * max(v.get("qty", 0), 1)
                items_m[item]["_price_count"] += max(v.get("qty", 0), 1)

    for item in items_m:
        ps = items_m[item].pop("_price_sum", 0.0)
        pc = items_m[item].pop("_price_count", 1)
        items_m[item]["avg_price"] = round(ps / pc if pc else 0.0, 2)
    merged["items"] = items_m

    # ── Top invoices: merge and re-sort ───────────────────────────────────────
    inv_map: Dict[str, dict] = {}
    for c in cubes_list:
        for inv in c.get("top_invoices", []):
            k = inv.get("inv_key", "")
            if k not in inv_map:
                inv_map[k] = dict(inv)
            else:
                inv_map[k]["nr"] = round(inv_map[k]["nr"] + inv.get("nr", 0.0), 2)
    merged["top_invoices"] = sorted(
        inv_map.values(), key=lambda x: -x.get("nr", 0.0)
    )[:100]

    return merged
