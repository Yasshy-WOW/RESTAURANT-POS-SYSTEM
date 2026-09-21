from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base


class Transaction(Base):
    """取引(購入)記録(要件3.6/5, 決定事項No.12)。

    合計金額はbigint(設計仕様書3章「合計金額列の型」: 単価上限999,999円×数量上限99個×
    行数上限50行で理論上の最大値が約49.5億円となり32bit intの上限を超えるため)。
    """

    __tablename__ = "transaction"

    transaction_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    transacted_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff.staff_id"), nullable=False)
    member_id: Mapped[int | None] = mapped_column(ForeignKey("member.member_id"), nullable=True)
    tax_rate_percent_snapshot: Mapped[int] = mapped_column(Integer, nullable=False)
    total_amount_with_tax: Mapped[int] = mapped_column(BigInteger, nullable=False)
    total_amount_without_tax: Mapped[int] = mapped_column(BigInteger, nullable=False)

    details: Mapped[list["TransactionDetail"]] = relationship(
        back_populates="transaction", cascade="all, delete-orphan"
    )


class TransactionDetail(Base):
    """取引明細。確定時点のメニュー名・単価をスナップショットとして複製保存する。"""

    __tablename__ = "transaction_detail"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey("transaction.transaction_id"), nullable=False)
    menu_no: Mapped[int] = mapped_column(ForeignKey("menu.menu_no"), nullable=False)
    menu_name_snapshot: Mapped[str] = mapped_column(String(50), nullable=False)
    unit_price_snapshot: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    subtotal: Mapped[int] = mapped_column(Integer, nullable=False)

    transaction: Mapped[Transaction] = relationship(back_populates="details")
