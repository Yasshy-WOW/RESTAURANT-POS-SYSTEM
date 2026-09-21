from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_staff, get_db, require_admin
from app.core.errors import MenuNotFound
from app.models.menu import Menu
from app.models.staff import Staff
from app.schemas.menu import (
    MenuCreate,
    MenuCreateOut,
    MenuListOut,
    MenuLookupOut,
    MenuOut,
    MenuUpdate,
)
from app.services.numbering import MENU_NO_WIDTH, ensure_within_range, format_id, parse_id

router = APIRouter(prefix="/menus", tags=["menus"])


def _menu_to_out(menu: Menu) -> MenuOut:
    return MenuOut(
        menu_no=format_id(menu.menu_no, MENU_NO_WIDTH),
        name=menu.name,
        price=menu.price,
        is_active=menu.is_active,
        created_at=menu.created_at,
        updated_at=menu.updated_at,
    )


@router.get("/{menu_no}", response_model=MenuLookupOut)
def get_menu(
    menu_no: str,
    db: Session = Depends(get_db),
    _: Staff = Depends(get_current_staff),
) -> MenuLookupOut:
    """メニュー検索(手入力・スキャン共通。要件3.3.1/3.3.2)。"""
    pk = parse_id(menu_no, MENU_NO_WIDTH, "menuNo")
    menu = db.get(Menu, pk)
    if menu is None or not menu.is_active:
        raise MenuNotFound()
    return MenuLookupOut(menu_no=format_id(menu.menu_no, MENU_NO_WIDTH), name=menu.name, price=menu.price)


@router.get("", response_model=MenuListOut)
def list_menus(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    include_deleted: bool = Query(default=False, alias="includeDeleted"),
    db: Session = Depends(get_db),
    _: Staff = Depends(require_admin),
) -> MenuListOut:
    stmt = select(Menu)
    if not include_deleted:
        stmt = stmt.where(Menu.is_active.is_(True))
    stmt = stmt.order_by(Menu.menu_no).offset(offset).limit(limit)
    menus = db.scalars(stmt).all()
    return MenuListOut(menus=[_menu_to_out(m) for m in menus])


@router.post("", response_model=MenuCreateOut, status_code=201)
def create_menu(
    payload: MenuCreate,
    db: Session = Depends(get_db),
    _: Staff = Depends(require_admin),
) -> MenuCreateOut:
    menu = Menu(name=payload.name, price=payload.price, is_active=True)
    db.add(menu)
    db.commit()
    db.refresh(menu)
    ensure_within_range(menu.menu_no, MENU_NO_WIDTH, "menuNo")
    return MenuCreateOut(menu_no=format_id(menu.menu_no, MENU_NO_WIDTH))


@router.put("/{menu_no}", status_code=204)
def update_menu(
    menu_no: str,
    payload: MenuUpdate,
    db: Session = Depends(get_db),
    _: Staff = Depends(require_admin),
) -> Response:
    """メニュー更新・復元(isActive: false->trueで復元。決定事項No.36)。

    単価を更新しても、既存の取引明細はunit_price_snapshotに確定時点の値を
    保持しているため影響を受けない(要件3.6節・決定事項No.12と同様の考え方)。
    """
    pk = parse_id(menu_no, MENU_NO_WIDTH, "menuNo")
    menu = db.get(Menu, pk)
    if menu is None:
        raise MenuNotFound()

    update_data = payload.model_dump(exclude_unset=True, by_alias=False)
    for field, value in update_data.items():
        setattr(menu, field, value)

    db.commit()
    return Response(status_code=204)


@router.delete("/{menu_no}", status_code=204)
def delete_menu(
    menu_no: str,
    db: Session = Depends(get_db),
    _: Staff = Depends(require_admin),
) -> Response:
    """メニュー削除(論理削除。決定事項No.25・36)。"""
    pk = parse_id(menu_no, MENU_NO_WIDTH, "menuNo")
    menu = db.get(Menu, pk)
    if menu is None:
        raise MenuNotFound()

    menu.is_active = False
    db.commit()
    return Response(status_code=204)
