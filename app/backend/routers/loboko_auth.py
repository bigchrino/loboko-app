# @File: backend/routers/loboko_auth.py
# @Desc: LOBOKO custom email/password authentication + profile management,
#        decoupled from Atoms identity so multiple LOBOKO accounts can coexist
#        under a single browser-level Atoms session.

import hashlib
import hmac
import logging
import secrets
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from schemas.auth import UserResponse
from models.loboko_accounts import Loboko_accounts
from models.profiles import Profiles

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/loboko_auth", tags=["loboko_auth"])


# ---------- Password helpers ----------
def _hash_password(password: str, salt: Optional[str] = None) -> str:
    """Return salt$hash using PBKDF2-HMAC-SHA256."""
    if salt is None:
        salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 200_000
    )
    return f"{salt}${digest.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        salt, _ = stored.split("$", 1)
    except ValueError:
        return False
    return hmac.compare_digest(_hash_password(password, salt), stored)


def _loboko_user_id(account_id: int) -> str:
    """Stable synthetic user_id used to scope profiles per LOBOKO account."""
    return f"loboko:{account_id}"


# ---------- Auth schemas ----------
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    role: str
    display_name: str
    metier: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AccountResponse(BaseModel):
    id: int
    email: str
    role: str
    display_name: str
    metier: Optional[str] = None


# ---------- Profile schemas ----------
class ProfileCreateRequest(BaseModel):
    account_id: int
    username: str
    display_name: Optional[str] = None
    bio: Optional[str] = None
    metier: Optional[str] = None
    avatar_key: Optional[str] = None
    role: str
    theme: Optional[str] = "dark"


class ProfileUpdateRequest(BaseModel):
    account_id: int
    username: Optional[str] = None
    display_name: Optional[str] = None
    bio: Optional[str] = None
    metier: Optional[str] = None
    avatar_key: Optional[str] = None
    role: Optional[str] = None
    theme: Optional[str] = None


class ProfileResponse(BaseModel):
    id: int
    user_id: str
    username: str
    display_name: Optional[str] = None
    bio: Optional[str] = None
    metier: Optional[str] = None
    avatar_key: Optional[str] = None
    role: str
    theme: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ProfileListResponse(BaseModel):
    items: List[ProfileResponse]
    total: int


# ---------- Auth routes ----------
@router.post("/register", response_model=AccountResponse)
async def register(
    data: RegisterRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register a new LOBOKO account bound to the current Atoms session."""
    if data.role not in ("client", "prestataire"):
        raise HTTPException(status_code=400, detail="Invalid role")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if data.role == "prestataire" and not (data.metier or "").strip():
        raise HTTPException(status_code=400, detail="metier is required for prestataire")

    email = data.email.lower().strip()

    result = await db.execute(
        select(Loboko_accounts).where(Loboko_accounts.email == email)
    )
    existing = result.scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail="Email already registered")

    account = Loboko_accounts(
        email=email,
        password_hash=_hash_password(data.password),
        role=data.role,
        display_name=data.display_name.strip() or email,
        metier=(data.metier or "").strip() or None,
        atoms_user_id=str(current_user.id),
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)

    return AccountResponse(
        id=account.id,
        email=account.email,
        role=account.role,
        display_name=account.display_name,
        metier=account.metier,
    )


@router.post("/login", response_model=AccountResponse)
async def login(
    data: LoginRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify LOBOKO email/password and return the account info."""
    _ = current_user  # Atoms session required but not tied to the account
    email = data.email.lower().strip()
    result = await db.execute(
        select(Loboko_accounts).where(Loboko_accounts.email == email)
    )
    account = result.scalar_one_or_none()
    if account is None or not _verify_password(data.password, account.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return AccountResponse(
        id=account.id,
        email=account.email,
        role=account.role,
        display_name=account.display_name,
        metier=account.metier,
    )


# ---------- Profile routes (scoped by LOBOKO account) ----------
async def _assert_account_exists(db: AsyncSession, account_id: int) -> Loboko_accounts:
    result = await db.execute(
        select(Loboko_accounts).where(Loboko_accounts.id == account_id)
    )
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=404, detail="LOBOKO account not found")
    return account


@router.get("/profile", response_model=ProfileListResponse)
async def get_profile(
    account_id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the profile for a given LOBOKO account (0 or 1 item)."""
    _ = current_user
    await _assert_account_exists(db, account_id)
    uid = _loboko_user_id(account_id)
    result = await db.execute(select(Profiles).where(Profiles.user_id == uid))
    items = result.scalars().all()
    return ProfileListResponse(items=items, total=len(items))


@router.post("/profile", response_model=ProfileResponse, status_code=201)
async def create_profile(
    data: ProfileCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create the LOBOKO-account-scoped profile (one per account)."""
    _ = current_user
    await _assert_account_exists(db, data.account_id)

    if data.role not in ("client", "prestataire"):
        raise HTTPException(status_code=400, detail="Invalid role")

    uid = _loboko_user_id(data.account_id)
    existing = await db.execute(select(Profiles).where(Profiles.user_id == uid))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Profile already exists for this account")

    profile = Profiles(
        user_id=uid,
        username=data.username.strip(),
        display_name=(data.display_name or data.username).strip(),
        bio=(data.bio or "").strip() or None,
        metier=(data.metier or "").strip() or None,
        avatar_key=data.avatar_key,
        role=data.role,
        theme=data.theme or "dark",
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


@router.put("/profile", response_model=ProfileResponse)
async def update_profile(
    data: ProfileUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Partially update the LOBOKO-account-scoped profile."""
    _ = current_user
    await _assert_account_exists(db, data.account_id)
    uid = _loboko_user_id(data.account_id)
    result = await db.execute(select(Profiles).where(Profiles.user_id == uid))
    profile = result.scalar_one_or_none()
    if profile is None:
        raise HTTPException(status_code=404, detail="Profile not found")

    payload = data.model_dump(exclude={"account_id"}, exclude_none=True)
    for key, value in payload.items():
        if hasattr(profile, key):
            setattr(profile, key, value)

    await db.commit()
    await db.refresh(profile)
    return profile