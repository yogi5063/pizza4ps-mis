"""
User management — super-admin only.

Create logins, grant view rights (which pages + which outlets), activate/
deactivate, and reset a forgotten password (which forces the user to set a new
one on next login). Regular users cannot access these endpoints.
"""
from __future__ import annotations

import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from services.auth_service import get_password_hash, require_super_admin

router = APIRouter(prefix="/users", tags=["users"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    role: str = "user"                       # 'user' | 'super_admin'
    allowed_pages: Optional[List[str]] = None    # None/[] handled per role
    allowed_outlets: Optional[List[str]] = None  # None/[] = all outlets


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    allowed_pages: Optional[List[str]] = None
    allowed_outlets: Optional[List[str]] = None
    is_active: Optional[bool] = None


class ResetPassword(BaseModel):
    new_password: str


def _serialize(u: User) -> dict:
    return {
        "id": u.id,
        "username": u.username,
        "full_name": u.full_name,
        "role": u.role,
        "is_active": u.is_active,
        "must_change_password": bool(u.must_change_password),
        "allowed_pages": json.loads(u.allowed_pages) if u.allowed_pages else [],
        "allowed_outlets": json.loads(u.allowed_outlets) if u.allowed_outlets else [],
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
async def list_users(db: Session = Depends(get_db),
                     _: User = Depends(require_super_admin)):
    return [_serialize(u) for u in db.query(User).order_by(User.id).all()]


@router.post("")
async def create_user(body: UserCreate, db: Session = Depends(get_db),
                      _: User = Depends(require_super_admin)):
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(400, f"Username '{body.username}' already exists")
    if body.role not in ("user", "super_admin"):
        raise HTTPException(400, "role must be 'user' or 'super_admin'")
    u = User(
        username=body.username,
        full_name=body.full_name,
        hashed_password=get_password_hash(body.password),
        is_active=True,
        role=body.role,
        allowed_pages=json.dumps(body.allowed_pages) if body.allowed_pages else None,
        allowed_outlets=json.dumps(body.allowed_outlets) if body.allowed_outlets else None,
        must_change_password=True,   # first login forces a personal password
    )
    db.add(u); db.commit(); db.refresh(u)
    return _serialize(u)


@router.patch("/{user_id}")
async def update_user(user_id: int, body: UserUpdate, db: Session = Depends(get_db),
                      _: User = Depends(require_super_admin)):
    u = db.query(User).get(user_id)
    if not u:
        raise HTTPException(404, "User not found")
    if body.full_name is not None: u.full_name = body.full_name
    if body.role is not None:
        if body.role not in ("user", "super_admin"):
            raise HTTPException(400, "role must be 'user' or 'super_admin'")
        u.role = body.role
    if body.allowed_pages is not None:
        u.allowed_pages = json.dumps(body.allowed_pages) if body.allowed_pages else None
    if body.allowed_outlets is not None:
        u.allowed_outlets = json.dumps(body.allowed_outlets) if body.allowed_outlets else None
    if body.is_active is not None: u.is_active = body.is_active
    db.commit(); db.refresh(u)
    return _serialize(u)


@router.post("/{user_id}/reset-password")
async def reset_password(user_id: int, body: ResetPassword, db: Session = Depends(get_db),
                         _: User = Depends(require_super_admin)):
    """Super-admin resets a forgotten password; user must change it next login."""
    u = db.query(User).get(user_id)
    if not u:
        raise HTTPException(404, "User not found")
    u.hashed_password = get_password_hash(body.new_password)
    u.must_change_password = True
    db.commit()
    return {"id": u.id, "username": u.username, "must_change_password": True}


@router.delete("/{user_id}")
async def deactivate_user(user_id: int, db: Session = Depends(get_db),
                          current: User = Depends(require_super_admin)):
    u = db.query(User).get(user_id)
    if not u:
        raise HTTPException(404, "User not found")
    if u.id == current.id:
        raise HTTPException(400, "You cannot deactivate your own account")
    u.is_active = False
    db.commit()
    return {"id": u.id, "is_active": False}
