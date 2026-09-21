from datetime import datetime

from pydantic import Field

from app.schemas.common import CamelModel


class TransactionItem(CamelModel):
    menu_no: str = Field(pattern=r"^\d{4}$")
    # 数量上限(99個・決定事項No.16)の防御的な再検証(設計8章)
    quantity: int = Field(ge=1, le=99)


class FrontendCalculated(CamelModel):
    total_with_tax: int
    total_without_tax: int


class TransactionCreate(CamelModel):
    member_id: str | None = Field(default=None, pattern=r"^\d{8}$")
    # 購入リストの行数(メニュー種類数)は1〜50(設計6章)
    items: list[TransactionItem] = Field(min_length=1, max_length=50)
    frontend_calculated: FrontendCalculated


class TransactionCreateOut(CamelModel):
    transaction_id: int
    total_with_tax: int
    total_without_tax: int


class TransactionDetailOut(CamelModel):
    menu_no: str
    menu_name_snapshot: str
    unit_price_snapshot: int
    quantity: int
    subtotal: int


class TransactionOut(CamelModel):
    transaction_id: int
    transacted_at: datetime
    staff_id: str
    member_id: str | None
    tax_rate_percent_snapshot: int
    total_amount_with_tax: int
    total_amount_without_tax: int
    details: list[TransactionDetailOut]
