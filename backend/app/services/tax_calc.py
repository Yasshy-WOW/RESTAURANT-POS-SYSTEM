from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal


@dataclass(frozen=True)
class TaxLineInput:
    unit_price: int  # 税込み単価(確定時点のスナップショット)
    quantity: int


@dataclass(frozen=True)
class TaxTotals:
    total_with_tax: int
    total_without_tax: int


def round_half_up(value: Decimal) -> int:
    """四捨五入(要件3.7/決定事項No.24)。Pythonのround()は銀行丸めのため使用しない。"""
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def calc_line_without_tax(unit_price: int, quantity: int, rate_percent: int) -> int:
    """メニュー1行分の税抜き金額を計算する。行ごとに四捨五入する(決定事項No.24)。"""
    line_total_with_tax = Decimal(unit_price) * Decimal(quantity)
    divisor = Decimal(100 + rate_percent) / Decimal(100)
    return round_half_up(line_total_with_tax / divisor)


def calc_totals(lines: list[TaxLineInput], rate_percent: int) -> TaxTotals:
    """購入リスト全体の税込み・税抜き合計金額を計算する(要件3.7)。

    税込み合計は各行(単価×数量、共に整数円)の単純合計のため丸め不要。
    税抜き合計は、各行ごとに計算・四捨五入した金額を合計する
    (税込み合計を先に一括で割り戻すのではない点に注意。FT-075で検証)。
    """
    total_with_tax = sum(line.unit_price * line.quantity for line in lines)
    total_without_tax = sum(calc_line_without_tax(line.unit_price, line.quantity, rate_percent) for line in lines)
    return TaxTotals(total_with_tax=total_with_tax, total_without_tax=total_without_tax)
