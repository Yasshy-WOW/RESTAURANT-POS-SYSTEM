from pydantic import Field

from app.schemas.common import CamelModel


class TaxRateOut(CamelModel):
    rate_percent: int


class TaxRateCreate(CamelModel):
    # 0〜100の整数のみ(決定事項No.30・37)。Pydanticのint型は小数を自動で丸めず拒否する
    rate_percent: int = Field(ge=0, le=100)
