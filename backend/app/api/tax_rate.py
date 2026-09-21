from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_staff, get_db, require_admin
from app.models.staff import Staff
from app.models.tax_rate import TaxRate
from app.schemas.tax_rate import TaxRateCreate, TaxRateOut

router = APIRouter(prefix="/tax-rate", tags=["tax-rate"])


def get_current_tax_rate_percent(db: Session) -> int:
    """idが最大の行を現在の税率とみなす(設計仕様書3章)。"""
    stmt = select(TaxRate).order_by(TaxRate.id.desc()).limit(1)
    current = db.scalars(stmt).first()
    return current.rate_percent if current is not None else 0


@router.get("", response_model=TaxRateOut)
def get_tax_rate(
    db: Session = Depends(get_db),
    _: Staff = Depends(get_current_staff),
) -> TaxRateOut:
    return TaxRateOut(rate_percent=get_current_tax_rate_percent(db))


@router.post("", status_code=201)
def create_tax_rate(
    payload: TaxRateCreate,
    db: Session = Depends(get_db),
    _: Staff = Depends(require_admin),
) -> None:
    """消費税率変更。UPDATEはせず新しい行をINSERTする(設計仕様書3章・8.5節)。"""
    db.add(TaxRate(rate_percent=payload.rate_percent))
    db.commit()
