from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_staff, get_db, require_admin
from app.core.errors import MemberNotFound
from app.models.member import Member
from app.models.staff import Staff
from app.schemas.member import (
    MemberCreate,
    MemberCreateOut,
    MemberListOut,
    MemberLookupOut,
    MemberOut,
    MemberUpdate,
)
from app.services.numbering import MEMBER_ID_WIDTH, ensure_within_range, format_id, parse_id

router = APIRouter(prefix="/members", tags=["members"])


def _member_to_out(member: Member) -> MemberOut:
    return MemberOut(
        member_id=format_id(member.member_id, MEMBER_ID_WIDTH),
        name=member.name,
        phone=member.phone,
        address=member.address,
        gender=member.gender.value,
        age=member.age,
        is_active=member.is_active,
        created_at=member.created_at,
        updated_at=member.updated_at,
    )


@router.get("/{member_id}", response_model=MemberLookupOut)
def get_member(
    member_id: str,
    db: Session = Depends(get_db),
    _: Staff = Depends(get_current_staff),
) -> MemberLookupOut:
    """会員照会(要件3.2)。氏名等は返さず会員IDのみ返す(決定事項No.20)。"""
    pk = parse_id(member_id, MEMBER_ID_WIDTH, "memberId")
    member = db.get(Member, pk)
    if member is None or not member.is_active:
        raise MemberNotFound()
    return MemberLookupOut(member_id=format_id(member.member_id, MEMBER_ID_WIDTH))


@router.get("", response_model=MemberListOut)
def list_members(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    include_deleted: bool = Query(default=False, alias="includeDeleted"),
    db: Session = Depends(get_db),
    _: Staff = Depends(require_admin),
) -> MemberListOut:
    stmt = select(Member)
    if not include_deleted:
        stmt = stmt.where(Member.is_active.is_(True))
    stmt = stmt.order_by(Member.member_id).offset(offset).limit(limit)
    members = db.scalars(stmt).all()
    return MemberListOut(members=[_member_to_out(m) for m in members])


@router.post("", response_model=MemberCreateOut, status_code=201)
def create_member(
    payload: MemberCreate,
    db: Session = Depends(get_db),
    _: Staff = Depends(require_admin),
) -> MemberCreateOut:
    member = Member(
        name=payload.name,
        phone=payload.phone,
        address=payload.address,
        gender=payload.gender,
        age=payload.age,
        is_active=True,
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    ensure_within_range(member.member_id, MEMBER_ID_WIDTH, "memberId")
    return MemberCreateOut(member_id=format_id(member.member_id, MEMBER_ID_WIDTH))


@router.put("/{member_id}", status_code=204)
def update_member(
    member_id: str,
    payload: MemberUpdate,
    db: Session = Depends(get_db),
    _: Staff = Depends(require_admin),
) -> Response:
    """会員更新・復元(isActive: false->trueで復元。決定事項No.36)。"""
    pk = parse_id(member_id, MEMBER_ID_WIDTH, "memberId")
    member = db.get(Member, pk)
    if member is None:
        raise MemberNotFound()

    update_data = payload.model_dump(exclude_unset=True, by_alias=False)
    for field, value in update_data.items():
        setattr(member, field, value)

    db.commit()
    return Response(status_code=204)


@router.delete("/{member_id}", status_code=204)
def delete_member(
    member_id: str,
    db: Session = Depends(get_db),
    _: Staff = Depends(require_admin),
) -> Response:
    """会員削除(論理削除。決定事項No.36で復元可能)。"""
    pk = parse_id(member_id, MEMBER_ID_WIDTH, "memberId")
    member = db.get(Member, pk)
    if member is None:
        raise MemberNotFound()

    member.is_active = False
    db.commit()
    return Response(status_code=204)
