from collections.abc import Generator

import jwt
from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.core.errors import AuthForbidden, AuthTokenExpired
from app.core.security import decode_access_token
from app.db.base import get_db as _get_db
from app.models.staff import Staff, StaffRole

get_db = _get_db


def get_current_staff(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Staff:
    """Authorizationヘッダ(Bearer JWT)を検証し、担当者を取得する。

    設計仕様書4.1節のシーケンス図では「トークン期限切れ/不正」を同一の401分岐として
    扱っており、未ログイン(トークン無し)もクライアント側では同じくログイン画面への
    遷移で処理されるため、これらはすべてAUTH_TOKEN_EXPIREDとして統一的に扱う。
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AuthTokenExpired()

    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = decode_access_token(token)
    except jwt.PyJWTError:
        raise AuthTokenExpired()

    staff_id_raw = payload.get("sub")
    if staff_id_raw is None or not str(staff_id_raw).isdigit():
        raise AuthTokenExpired()

    staff = db.get(Staff, int(staff_id_raw))
    if staff is None or not staff.is_active:
        raise AuthTokenExpired()

    return staff


def require_admin(staff: Staff = Depends(get_current_staff)) -> Staff:
    if staff.role != StaffRole.ADMIN:
        raise AuthForbidden()
    return staff
