from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.core.deps import get_current_staff, get_db
from app.core.errors import AuthInvalidCredentials
from app.core.security import create_access_token, verify_password
from app.models.staff import Staff
from app.schemas.auth import LoginRequest, LoginResponse, MeResponse
from app.services.numbering import STAFF_ID_WIDTH, format_id, parse_id

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    staff_pk = parse_id(payload.staff_id, STAFF_ID_WIDTH, "staffId")
    staff = db.get(Staff, staff_pk)

    # 論理削除済みの担当者は、存在しない担当者IDと同様に扱う
    # (パスワード誤りと区別しないのと同じ理由で、削除済みかどうかも外部に漏らさない。設計8.1節)
    if staff is None or not staff.is_active:
        raise AuthInvalidCredentials()

    if not verify_password(payload.password, staff.password_hash):
        raise AuthInvalidCredentials()

    token = create_access_token(staff_id=format_id(staff.staff_id, STAFF_ID_WIDTH), role=staff.role.value)
    return LoginResponse(token=token, role=staff.role.value)


@router.post("/logout", status_code=204)
def logout(_: Staff = Depends(get_current_staff)) -> Response:
    # JWTのサーバー側強制失効は行わない(設計5.1節: ログアウトの限界)。
    return Response(status_code=204)


@router.get("/me", response_model=MeResponse)
def me(staff: Staff = Depends(get_current_staff)) -> MeResponse:
    return MeResponse(staff_id=format_id(staff.staff_id, STAFF_ID_WIDTH), role=staff.role.value)
