"""
auth.py
-------
JWT authentication and password hashing for the VisionAdapt API.

Uses bcrypt directly (passlib has compatibility issues with bcrypt 5.x).
Tokens expire after 24 hours. Secret key is read from the
VISIONADAPT_SECRET environment variable (falls back to a dev default).
"""
import os
import time
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

SECRET_KEY = os.getenv("VISIONADAPT_SECRET", "visionadapt-dev-secret-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/v1/auth/login")


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# In-memory user store (replace with a database in production)
_users: dict[str, dict] = {}

# Default admin account (for demo / hackathon judging)
_users["admin@visionadapt.com"] = {
    "email": "admin@visionadapt.com",
    "hashed_password": _hash_password("visionadapt123"),
    "display_name": "Admin",
}


def create_access_token(email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    return jwt.encode(
        {"sub": email, "exp": expire, "iat": int(time.time())},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    payload = decode_token(token)
    email = payload.get("sub")
    if email is None or email not in _users:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return _users[email]


def register_user(email: str, password: str, display_name: str | None = None) -> dict:
    if email in _users:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already exists",
        )
    user = {
        "email": email,
        "hashed_password": _hash_password(password),
        "display_name": display_name or email.split("@")[0],
    }
    _users[email] = user
    return {"email": email, "display_name": user["display_name"]}


def authenticate_user(email: str, password: str) -> dict:
    user = _users.get(email)
    if not user or not _verify_password(password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    return user
