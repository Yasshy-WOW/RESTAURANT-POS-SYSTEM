from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError, InvalidHashError

from app.core.config import settings

# パスワードのハッシュ化はargon2id(設計仕様書5.1節: bcryptの72バイト制限を避けるため)
_password_hasher = PasswordHasher()


def hash_password(plain_password: str) -> str:
    return _password_hasher.hash(plain_password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return _password_hasher.verify(password_hash, plain_password)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def create_access_token(*, staff_id: str, role: str) -> str:
    """JWT発行(設計仕様書5.1節)。claims=sub(担当者ID)/role/iat/exp。有効期限30分。"""
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": staff_id,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    """JWT検証。期限切れ・不正な場合はjwtライブラリの例外がそのまま送出される。"""
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
