from app.models.menu import Menu
from app.services.numbering import MENU_NO_WIDTH, format_id
from app.services.tax_calc import TaxLineInput, calc_totals


def build_transaction_payload(
    items: list[tuple[Menu, int]], rate_percent: int, member_id: str | None = None
) -> dict:
    """メニュー・数量のリストから、フロントエンド計算値付きの購入確定リクエストを組み立てる。

    テスト対象APIとまったく同じ丸めロジック(app.services.tax_calc)を使って
    frontendCalculatedを算出することで、二重計算照合(設計4.2/5.4節)が
    正常系では必ず一致するようにする。
    """
    totals = calc_totals(
        [TaxLineInput(unit_price=menu.price, quantity=quantity) for menu, quantity in items], rate_percent
    )
    return {
        "memberId": member_id,
        "items": [
            {"menuNo": format_id(menu.menu_no, MENU_NO_WIDTH), "quantity": quantity} for menu, quantity in items
        ],
        "frontendCalculated": {"totalWithTax": totals.total_with_tax, "totalWithoutTax": totals.total_without_tax},
    }
