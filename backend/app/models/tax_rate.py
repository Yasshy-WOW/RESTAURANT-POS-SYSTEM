from datetime import datetime

from sqlalchemy import DateTime, Integer
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.db.base import Base


class TaxRate(Base):
    """消費税率(要件3.7, 決定事項No.3・12・30・37)。

    UPDATEは行わずINSERTのみで履歴を積み上げ、idが最大の行を現在値とみなす
    (設計仕様書3章「消費税率の『現在値』判定」)。
    """

    __tablename__ = "tax_rate"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    rate_percent: Mapped[int] = mapped_column(Integer, nullable=False)
    effective_from: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
