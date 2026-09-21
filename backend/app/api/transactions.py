from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.tax_rate import get_current_tax_rate_percent
from app.core.deps import get_current_staff, get_db, require_admin
from app.core.errors import CalculationMismatch, MemberNotFound, MenuDeletedInCart, TransactionNotFound
from app.models.member import Member
from app.models.menu import Menu
from app.models.staff import Staff
from app.models.transaction import Transaction, TransactionDetail
from app.schemas.transaction import (
    TransactionCreate,
    TransactionCreateOut,
    TransactionDetailOut,
    TransactionOut,
)
from app.services.numbering import MEMBER_ID_WIDTH, MENU_NO_WIDTH, STAFF_ID_WIDTH, format_id, parse_id
from app.services.tax_calc import TaxLineInput, calc_totals

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.post("", response_model=TransactionCreateOut, status_code=201)
def create_transaction(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    staff: Staff = Depends(get_current_staff),
) -> TransactionCreateOut:
    """購入確定(要件3.6/3.7)。フロント計算値は保存せず、サーバー側で独自に再計算・照合する
    (設計仕様書4.2節・5.4節)。不一致・削除済みメニュー混入時は確定させない。
    """
    member_pk: int | None = None
    if payload.member_id is not None:
        member_pk = parse_id(payload.member_id, MEMBER_ID_WIDTH, "memberId")
        member = db.get(Member, member_pk)
        if member is None or not member.is_active:
            raise MemberNotFound()

    items_with_menu: list[tuple[int, Menu]] = []
    for item in payload.items:
        menu_pk = parse_id(item.menu_no, MENU_NO_WIDTH, "menuNo")
        menu = db.get(Menu, menu_pk)
        if menu is None or not menu.is_active:
            raise MenuDeletedInCart(details={"menuNo": item.menu_no})
        items_with_menu.append((menu_pk, menu))

    rate_percent = get_current_tax_rate_percent(db)
    line_inputs = [
        TaxLineInput(unit_price=menu.price, quantity=item.quantity)
        for item, (_, menu) in zip(payload.items, items_with_menu)
    ]
    totals = calc_totals(line_inputs, rate_percent)

    if (
        totals.total_with_tax != payload.frontend_calculated.total_with_tax
        or totals.total_without_tax != payload.frontend_calculated.total_without_tax
    ):
        raise CalculationMismatch(
            details={
                "server": {"totalWithTax": totals.total_with_tax, "totalWithoutTax": totals.total_without_tax},
                "frontend": {
                    "totalWithTax": payload.frontend_calculated.total_with_tax,
                    "totalWithoutTax": payload.frontend_calculated.total_without_tax,
                },
            }
        )

    transaction = Transaction(
        staff_id=staff.staff_id,
        member_id=member_pk,
        tax_rate_percent_snapshot=rate_percent,
        total_amount_with_tax=totals.total_with_tax,
        total_amount_without_tax=totals.total_without_tax,
    )
    for item, (_, menu) in zip(payload.items, items_with_menu):
        transaction.details.append(
            TransactionDetail(
                menu_no=menu.menu_no,
                menu_name_snapshot=menu.name,
                unit_price_snapshot=menu.price,
                quantity=item.quantity,
                subtotal=menu.price * item.quantity,
            )
        )

    db.add(transaction)
    db.commit()
    db.refresh(transaction)

    return TransactionCreateOut(
        transaction_id=transaction.transaction_id,
        total_with_tax=totals.total_with_tax,
        total_without_tax=totals.total_without_tax,
    )


@router.get("/{transaction_id}", response_model=TransactionOut)
def get_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    _: Staff = Depends(require_admin),
) -> TransactionOut:
    transaction = db.get(Transaction, transaction_id)
    if transaction is None:
        raise TransactionNotFound()

    return TransactionOut(
        transaction_id=transaction.transaction_id,
        transacted_at=transaction.transacted_at,
        staff_id=format_id(transaction.staff_id, STAFF_ID_WIDTH),
        member_id=format_id(transaction.member_id, MEMBER_ID_WIDTH) if transaction.member_id is not None else None,
        tax_rate_percent_snapshot=transaction.tax_rate_percent_snapshot,
        total_amount_with_tax=transaction.total_amount_with_tax,
        total_amount_without_tax=transaction.total_amount_without_tax,
        details=[
            TransactionDetailOut(
                menu_no=format_id(d.menu_no, MENU_NO_WIDTH),
                menu_name_snapshot=d.menu_name_snapshot,
                unit_price_snapshot=d.unit_price_snapshot,
                quantity=d.quantity,
                subtotal=d.subtotal,
            )
            for d in transaction.details
        ],
    )
