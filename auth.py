import os
import time
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from models import UserPublic

SECRET_KEY = os.getenv("VISIONADAPT_SECRET", "visionadapt-dev-secret-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 72

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

_users: dict[str, dict] = {}
_users["admin@visionadapt.com"] = {
    "email": "admin@visionadapt.com",
    "hashed_password": bcrypt.hashpw("visionadapt123".encode(), bcrypt.gensalt()).decode(),
    "display_name": "Admin",
    "created_at": time.time(),
}

_user_profiles: dict[str, dict] = {}


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": email, "exp": expire, "iat": int(time.time())}, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("sub") is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(token: str | None = Depends(oauth2_scheme)) -> dict:
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    payload = decode_token(token)
    email = payload.get("sub")
    if email is None or email not in _users:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return _users[email]


def register_user(email: str, password: str, display_name: str | None = None) -> dict:
    if email in _users:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists")
    user = {
        "email": email,
        "hashed_password": _hash_password(password),
        "display_name": (display_name or email.split("@")[0])[:64],
        "created_at": time.time(),
    }
    _users[email] = user
    return UserPublic(email=email, display_name=user["display_name"]).model_dump()


def authenticate_user(email: str, password: str) -> dict:
    user = _users.get(email)
    if not user or not _verify_password(password, user["hashed_password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    return user


def get_user_public(user: dict) -> dict:
    return UserPublic(email=user["email"], display_name=user["display_name"]).model_dump()


def save_user_profile(email: str, profile: dict) -> dict:
    import time as _time
    profile["updated_at"] = _time.time()
    _user_profiles[email] = profile
    return profile


def get_user_profile(email: str) -> dict | None:
    return _user_profiles.get(email)
