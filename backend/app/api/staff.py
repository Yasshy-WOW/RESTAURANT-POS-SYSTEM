from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_admin
from app.core.errors import LastAdminProtection, StaffNotFound
from app.core.security import hash_password
from app.models.staff import Staff, StaffRole
from app.schemas.staff import StaffCreate, StaffCreateOut, StaffListOut, StaffOut, StaffUpdate
from app.services.numbering import STAFF_ID_WIDTH, ensure_within_range, format_id, parse_id

router = APIRouter(prefix="/staff", tags=["staff"])


def _staff_to_out(staff: Staff) -> StaffOut:
    return StaffOut(
        staff_id=format_id(staff.staff_id, STAFF_ID_WIDTH),
        role=staff.role.value,
        is_active=staff.is_active,
        created_at=staff.created_at,
        updated_at=staff.updated_at,
    )


def _count_other_active_admins(db: Session, exclude_staff_id: int) -> int:
    stmt = select(func.count()).select_from(Staff).where(
        Staff.role == StaffRole.ADMIN,
        Staff.is_active.is_(True),
        Staff.staff_id != exclude_staff_id,
    )
    return db.scalar(stmt) or 0


@router.get("", response_model=StaffListOut)
def list_staff(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    include_deleted: bool = Query(default=False, alias="includeDeleted"),
    db: Session = Depends(get_db),
    _: Staff = Depends(require_admin),
) -> StaffListOut:
    stmt = select(Staff)
    if not include_deleted:
        stmt = stmt.where(Staff.is_active.is_(True))
    stmt = stmt.order_by(Staff.staff_id).offset(offset).limit(limit)
    staff_rows = db.scalars(stmt).all()
    return StaffListOut(staff=[_staff_to_out(s) for s in staff_rows])


@router.post("", response_model=StaffCreateOut, status_code=201)
def create_staff(
    payload: StaffCreate,
    db: Session = Depends(get_db),
    _: Staff = Depends(require_admin),
) -> StaffCreateOut:
    staff = Staff(password_hash=hash_password(payload.password), role=StaffRole(payload.role), is_active=True)
    db.add(staff)
    db.commit()
    db.refresh(staff)
    ensure_within_range(staff.staff_id, STAFF_ID_WIDTH, "staffId")
    return StaffCreateOut(staff_id=format_id(staff.staff_id, STAFF_ID_WIDTH))


@router.put("/{staff_id}", status_code=204)
def update_staff(
    staff_id: str,
    payload: StaffUpdate,
    db: Session = Depends(get_db),
    _: Staff = Depends(require_admin),
) -> Response:
    """担当者更新(パスワード・権限変更・復元)。最後の管理者の降格は禁止(決定事項No.22)。"""
    pk = parse_id(staff_id, STAFF_ID_WIDTH, "staffId")
    staff = db.get(Staff, pk)
    if staff is None:
        raise StaffNotFound()

    new_role = StaffRole(payload.role) if payload.role is not None else staff.role
    new_is_active = payload.is_active if payload.is_active is not None else staff.is_active

    was_active_admin = staff.role == StaffRole.ADMIN and staff.is_active
    will_remain_active_admin = new_role == StaffRole.ADMIN and new_is_active
    if was_active_admin and not will_remain_active_admin:
        if _count_other_active_admins(db, staff.staff_id) == 0:
            raise LastAdminProtection()

    if payload.password is not None:
        staff.password_hash = hash_password(payload.password)
    staff.role = new_role
    staff.is_active = new_is_active

    db.commit()
    return Response(status_code=204)


@router.delete("/{staff_id}", status_code=204)
def delete_staff(
    staff_id: str,
    db: Session = Depends(get_db),
    _: Staff = Depends(require_admin),
) -> Response:
    """担当者削除(論理削除)。最後の管理者の削除は禁止(決定事項No.22)。"""
    pk = parse_id(staff_id, STAFF_ID_WIDTH, "staffId")
    staff = db.get(Staff, pk)
    if staff is None:
        raise StaffNotFound()

    if staff.role == StaffRole.ADMIN and staff.is_active:
        if _count_other_active_admins(db, staff.staff_id) == 0:
            raise LastAdminProtection()

    staff.is_active = False
    db.commit()
    return Response(status_code=204)
