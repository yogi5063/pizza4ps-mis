"""
Settings router – FX rates and monthly revenue targets.
"""

from __future__ import annotations

import json
from typing import Dict, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.settings import Settings
from models.user import User
from services.auth_service import get_current_user

router = APIRouter(prefix="/settings", tags=["settings"])

# ── Default values ─────────────────────────────────────────────────────────────

DEFAULT_FX_RATES: Dict[str, float] = {
    "INR": 1.0,
    "VND": 305.0,
    "USD": 0.012,
    "EUR": 0.011,
    "SGD": 0.016,
    "JPY": 1.78,
    "GBP": 0.0094,
    "AUD": 0.018,
    "THB": 0.43,
}

DEFAULT_TARGETS: Dict[str, Any] = {
    "2026-01": {"target": 0, "target_inv_count": 0},
    "2026-02": {"target": 0, "target_inv_count": 0},
    "2026-03": {"target": 0, "target_inv_count": 0},
}

# ── DB helpers ─────────────────────────────────────────────────────────────────

def _get_setting(db: Session, key: str) -> Any:
    record = db.query(Settings).filter(Settings.key == key).first()
    if record and record.value_json:
        return json.loads(record.value_json)
    return None


def _set_setting(db: Session, key: str, value: Any) -> Settings:
    record = db.query(Settings).filter(Settings.key == key).first()
    if record is None:
        record = Settings(key=key)
        db.add(record)
    record.value_json = json.dumps(value)
    db.commit()
    db.refresh(record)
    return record


def _init_defaults(db: Session) -> None:
    """Seed default settings if not already present."""
    if _get_setting(db, "fx_rates") is None:
        _set_setting(db, "fx_rates", DEFAULT_FX_RATES)
    if _get_setting(db, "targets") is None:
        _set_setting(db, "targets", DEFAULT_TARGETS)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/fx-rates")
async def get_fx_rates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return current FX rates. Falls back to defaults if not set."""
    _init_defaults(db)
    rates = _get_setting(db, "fx_rates") or DEFAULT_FX_RATES
    return {
        "fx_rates": rates,
        "base_currency": "INR",
        "description": "Multiply INR value by rate to convert to target currency",
    }


@router.put("/fx-rates")
@router.post("/fx-rates")
async def update_fx_rates(
    payload: Dict[str, float],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update FX rates. Pass a dict of {currency_code: rate}."""
    if not payload:
        raise HTTPException(status_code=400, detail="Payload cannot be empty")

    # Merge with existing rates
    existing = _get_setting(db, "fx_rates") or dict(DEFAULT_FX_RATES)
    existing.update(payload)
    _set_setting(db, "fx_rates", existing)

    return {
        "message": "FX rates updated successfully",
        "fx_rates": existing,
    }


@router.get("/targets")
async def get_targets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return monthly revenue targets as flat {month_key: target_number}."""
    _init_defaults(db)
    stored = _get_setting(db, "targets") or DEFAULT_TARGETS
    # Flatten: support both {month: number} and {month: {target: number}} formats
    result = {}
    for k, v in stored.items():
        result[k] = v.get("target", 0) if isinstance(v, dict) else (v or 0)
    return result


@router.put("/targets")
@router.post("/targets")
async def update_targets(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update monthly targets. Accepts {month_key: number} or {month_key: {target: number}}."""
    if not payload:
        raise HTTPException(status_code=400, detail="Payload cannot be empty")

    import re
    existing = _get_setting(db, "targets") or {}
    for month_key, val in payload.items():
        if not re.match(r"^\d{4}-\d{2}$", month_key):
            continue
        # Accept both plain number and nested dict
        target_num = val.get("target", 0) if isinstance(val, dict) else (float(val) if val else 0)
        existing[month_key] = {"target": target_num, "target_inv_count": 0}
    _set_setting(db, "targets", existing)

    # Return flat format
    return {k: v.get("target", 0) if isinstance(v, dict) else v for k, v in existing.items()}


@router.delete("/targets/{month_key}")
async def delete_target(
    month_key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a specific month's target."""
    existing = _get_setting(db, "targets") or {}
    if month_key not in existing:
        raise HTTPException(status_code=404, detail=f"Target for {month_key} not found")
    del existing[month_key]
    _set_setting(db, "targets", existing)
    return {"message": f"Target for {month_key} deleted", "targets": existing}


@router.get("/all")
async def get_all_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all settings as a flat dict."""
    records = db.query(Settings).all()
    result = {}
    for r in records:
        try:
            result[r.key] = json.loads(r.value_json) if r.value_json else None
        except Exception:
            result[r.key] = r.value_json
    return result
