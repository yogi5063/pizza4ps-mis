"""
Masters router — user-managed geography: Country -> Location -> Outlet.

Lets users add/edit/deactivate countries, locations and outlets from the UI so
new stores/countries never require a code change. GET /masters/tree feeds the
shared page filter; the CRUD endpoints back the Masters admin page.
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.masters import Country, Location, Outlet
from models.user import User
from services.auth_service import get_current_user

router = APIRouter(prefix="/masters", tags=["masters"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class CountryIn(BaseModel):
    name: str
    code: Optional[str] = None
    currency: Optional[str] = None
    active: Optional[bool] = None


class LocationIn(BaseModel):
    country_id: int
    name: str
    active: Optional[bool] = None


class OutletIn(BaseModel):
    location_id: int
    code: str
    name: str
    currency: Optional[str] = None
    open_date: Optional[str] = None
    active: Optional[bool] = None


# ── Seed ──────────────────────────────────────────────────────────────────────

def seed_masters(db: Session) -> None:
    """Seed the initial India geography once, if empty."""
    if db.query(Country).count() > 0:
        return
    india = Country(name="India", code="IN", currency="INR", active=True)
    db.add(india)
    db.flush()
    blr = Location(country_id=india.id, name="Bengaluru", active=True)
    db.add(blr)
    db.flush()
    for code, name in [
        ("BGL-IDN", "Indiranagar"),
        ("BGL-BSC", "Bagmane"),
        ("BGL-CF", "Central Facility"),
        ("Back Office", "Back Office"),
    ]:
        db.add(Outlet(location_id=blr.id, code=code, name=name,
                      currency="INR", active=True))
    db.commit()


# ── Tree (feeds the shared filter) ────────────────────────────────────────────

@router.get("/tree")
async def get_tree(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full Country -> Location -> Outlet tree for the filter component."""
    q = db.query(Country)
    if not include_inactive:
        q = q.filter(Country.active.is_(True))
    out = []
    for c in q.order_by(Country.name).all():
        locs = []
        for loc in c.locations:
            if not include_inactive and not loc.active:
                continue
            outlets = [
                {"id": o.id, "code": o.code, "name": o.name,
                 "currency": o.currency, "active": o.active}
                for o in loc.outlets
                if include_inactive or o.active
            ]
            locs.append({"id": loc.id, "name": loc.name, "active": loc.active,
                         "outlets": outlets})
        out.append({"id": c.id, "name": c.name, "code": c.code,
                    "currency": c.currency, "active": c.active, "locations": locs})
    return {"countries": out}


# ── Country CRUD ──────────────────────────────────────────────────────────────

@router.post("/countries")
async def create_country(body: CountryIn, db: Session = Depends(get_db),
                         current_user: User = Depends(get_current_user)):
    if db.query(Country).filter(Country.name == body.name).first():
        raise HTTPException(400, f"Country '{body.name}' already exists")
    c = Country(name=body.name, code=body.code, currency=body.currency,
                active=True if body.active is None else body.active)
    db.add(c); db.commit(); db.refresh(c)
    return {"id": c.id, "name": c.name}


@router.patch("/countries/{country_id}")
async def update_country(country_id: int, body: CountryIn, db: Session = Depends(get_db),
                         current_user: User = Depends(get_current_user)):
    c = db.query(Country).get(country_id)
    if not c:
        raise HTTPException(404, "Country not found")
    c.name = body.name or c.name
    if body.code is not None: c.code = body.code
    if body.currency is not None: c.currency = body.currency
    if body.active is not None: c.active = body.active
    db.commit()
    return {"id": c.id, "name": c.name, "active": c.active}


@router.delete("/countries/{country_id}")
async def deactivate_country(country_id: int, db: Session = Depends(get_db),
                             current_user: User = Depends(get_current_user)):
    c = db.query(Country).get(country_id)
    if not c:
        raise HTTPException(404, "Country not found")
    c.active = False
    db.commit()
    return {"id": c.id, "active": False}


# ── Location CRUD ─────────────────────────────────────────────────────────────

@router.post("/locations")
async def create_location(body: LocationIn, db: Session = Depends(get_db),
                          current_user: User = Depends(get_current_user)):
    if not db.query(Country).get(body.country_id):
        raise HTTPException(400, "country_id not found")
    loc = Location(country_id=body.country_id, name=body.name,
                   active=True if body.active is None else body.active)
    db.add(loc); db.commit(); db.refresh(loc)
    return {"id": loc.id, "name": loc.name}


@router.patch("/locations/{location_id}")
async def update_location(location_id: int, body: LocationIn, db: Session = Depends(get_db),
                          current_user: User = Depends(get_current_user)):
    loc = db.query(Location).get(location_id)
    if not loc:
        raise HTTPException(404, "Location not found")
    loc.name = body.name or loc.name
    if body.active is not None: loc.active = body.active
    db.commit()
    return {"id": loc.id, "name": loc.name, "active": loc.active}


@router.delete("/locations/{location_id}")
async def deactivate_location(location_id: int, db: Session = Depends(get_db),
                              current_user: User = Depends(get_current_user)):
    loc = db.query(Location).get(location_id)
    if not loc:
        raise HTTPException(404, "Location not found")
    loc.active = False
    db.commit()
    return {"id": loc.id, "active": False}


# ── Outlet CRUD ───────────────────────────────────────────────────────────────

@router.post("/outlets")
async def create_outlet(body: OutletIn, db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    if not db.query(Location).get(body.location_id):
        raise HTTPException(400, "location_id not found")
    if db.query(Outlet).filter(Outlet.code == body.code).first():
        raise HTTPException(400, f"Outlet code '{body.code}' already exists")
    o = Outlet(location_id=body.location_id, code=body.code, name=body.name,
               currency=body.currency, open_date=body.open_date,
               active=True if body.active is None else body.active)
    db.add(o); db.commit(); db.refresh(o)
    return {"id": o.id, "code": o.code, "name": o.name}


@router.patch("/outlets/{outlet_id}")
async def update_outlet(outlet_id: int, body: OutletIn, db: Session = Depends(get_db),
                        current_user: User = Depends(get_current_user)):
    o = db.query(Outlet).get(outlet_id)
    if not o:
        raise HTTPException(404, "Outlet not found")
    o.code = body.code or o.code
    o.name = body.name or o.name
    if body.currency is not None: o.currency = body.currency
    if body.open_date is not None: o.open_date = body.open_date
    if body.active is not None: o.active = body.active
    db.commit()
    return {"id": o.id, "code": o.code, "name": o.name, "active": o.active}


@router.delete("/outlets/{outlet_id}")
async def deactivate_outlet(outlet_id: int, db: Session = Depends(get_db),
                            current_user: User = Depends(get_current_user)):
    o = db.query(Outlet).get(outlet_id)
    if not o:
        raise HTTPException(404, "Outlet not found")
    o.active = False
    db.commit()
    return {"id": o.id, "active": False}
