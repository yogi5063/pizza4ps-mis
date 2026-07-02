import json
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from services.auth_service import (
    authenticate_user,
    create_access_token,
    get_current_user,
    get_password_hash,
    verify_password,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    username: str
    role: str
    must_change_password: bool


class ChangePassword(BaseModel):
    current_password: str
    new_password: str


def _user_payload(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "is_active": user.is_active,
        "role": getattr(user, "role", "user"),
        "must_change_password": bool(getattr(user, "must_change_password", False)),
        "allowed_pages": json.loads(user.allowed_pages) if user.allowed_pages else [],
        "allowed_outlets": json.loads(user.allowed_outlets) if user.allowed_outlets else [],
    }


@router.post("/login", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Account is deactivated")
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        username=user.username,
        role=getattr(user, "role", "user"),
        must_change_password=bool(getattr(user, "must_change_password", False)),
    )


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return _user_payload(current_user)


@router.post("/change-password")
async def change_password(
    body: ChangePassword,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Any logged-in user changes their own password (needs current password)."""
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(body.new_password) < 4:
        raise HTTPException(status_code=400, detail="New password is too short")
    current_user.hashed_password = get_password_hash(body.new_password)
    current_user.must_change_password = False
    db.commit()
    return {"message": "Password changed successfully"}
