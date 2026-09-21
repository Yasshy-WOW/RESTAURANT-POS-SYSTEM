from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.services.numbering import MENU_NO_WIDTH, format_id
from tests.helpers import build_transaction_payload


def test_create_transaction_success(client, general_headers, make_menu, tax_rate):
    """BE-008: 正しい内訳で取引が保存され、税込み・税抜き合計が返る。"""
    menu = make_menu(price=1000)
    payload = build_transaction_payload([(menu, 2)], rate_percent=10)

    resp = client.post("/api/transactions", json=payload, headers=general_headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["totalWithTax"] == 2000
    assert body["totalWithoutTax"] == 1818  # 2000 / 1.10 = 1818.18... -> 四捨五入


def test_create_transaction_empty_items(client, general_headers, tax_rate):
    """BE-009: 明細が空のリクエストは拒否される。"""
    resp = client.post(
        "/api/transactions",
        json={"memberId": None, "items": [], "frontendCalculated": {"totalWithTax": 0, "totalWithoutTax": 0}},
        headers=general_headers,
    )
    assert resp.status_code == 422


def test_create_transaction_deleted_menu(client, general_headers, make_menu, tax_rate):
    """BE-010: 削除済みメニューを含む明細は拒否される(要件3.6節・決定事項No.25)。"""
    menu = make_menu(price=500, is_active=False)
    payload = build_transaction_payload([(menu, 1)], rate_percent=10)

    resp = client.post("/api/transactions", json=payload, headers=general_headers)
    assert resp.status_code == 409
    assert resp.json()["error_code"] == "MENU_DELETED_IN_CART"


def test_transaction_tax_rounding_per_line(client, general_headers, make_menu, tax_rate):
    """BE-011/FT-043: 行ごとの税額計算で端数が四捨五入される。

    単価111円(税込み・税率10%)を1個購入 -> 税抜き101円(111/1.1=100.90...を四捨五入)。
    """
    menu = make_menu(price=111)
    payload = build_transaction_payload([(menu, 1)], rate_percent=10)

    resp = client.post("/api/transactions", json=payload, headers=general_headers)
    assert resp.status_code == 201
    assert resp.json()["totalWithTax"] == 111
    assert resp.json()["totalWithoutTax"] == 101


def test_transaction_tax_rounding_multiple_lines(client, general_headers, make_menu, tax_rate):
    """FT-075: 行ごと計算と一括計算で結果が異なるケース。

    単価105円(税率10%)を2種類、それぞれ1個ずつ購入すると、各行で
    105/1.1=95.45...を四捨五入して95円、2行分で税抜き合計190円になる
    (税込み合計210円を先に一括で割り戻すと191円になり結果が異なる)。
    """
    menu_a = make_menu(name="メニューA", price=105)
    menu_b = make_menu(name="メニューB", price=105)
    payload = build_transaction_payload([(menu_a, 1), (menu_b, 1)], rate_percent=10)

    resp = client.post("/api/transactions", json=payload, headers=general_headers)
    assert resp.status_code == 201
    assert resp.json()["totalWithTax"] == 210
    assert resp.json()["totalWithoutTax"] == 190


def test_create_transaction_calculation_mismatch_rejected(client, general_headers, make_menu, tax_rate):
    """設計4.2/5.4節: フロントの計算値とサーバー再計算値が不一致なら409。"""
    menu = make_menu(price=1000)
    payload = build_transaction_payload([(menu, 1)], rate_percent=10)
    payload["frontendCalculated"]["totalWithTax"] = 999999  # 意図的に改ざん

    resp = client.post("/api/transactions", json=payload, headers=general_headers)
    assert resp.status_code == 409
    assert resp.json()["error_code"] == "CALCULATION_MISMATCH"


def test_transaction_price_snapshot(client, admin_headers, general_headers, make_menu, tax_rate):
    """BE-012: 確定後にメニュー単価を変更しても、保存済み取引の単価は変わらない。"""
    menu = make_menu(price=500)
    payload = build_transaction_payload([(menu, 1)], rate_percent=10)

    create_resp = client.post("/api/transactions", json=payload, headers=general_headers)
    transaction_id = create_resp.json()["transactionId"]

    menu_no = format_id(menu.menu_no, MENU_NO_WIDTH)
    update_resp = client.put(f"/api/menus/{menu_no}", json={"price": 800}, headers=admin_headers)
    assert update_resp.status_code == 204

    get_resp = client.get(f"/api/transactions/{transaction_id}", headers=admin_headers)
    detail = get_resp.json()["details"][0]
    assert detail["unitPriceSnapshot"] == 500


def test_create_transaction_without_member(client, general_headers, make_menu, tax_rate):
    """BE-028: member_idを指定しない(会員なし)リクエストでも取引が正常に保存される。"""
    menu = make_menu(price=300)
    payload = build_transaction_payload([(menu, 1)], rate_percent=10, member_id=None)

    resp = client.post("/api/transactions", json=payload, headers=general_headers)
    assert resp.status_code == 201


def test_create_transaction_db_failure_returns_500_and_preserves_request(
    client_no_raise, general_headers, make_menu, tax_rate, monkeypatch
):
    """BE-020: DB保存失敗時に500系エラーが返り、同じ内容で再送すれば成功する
    (要件3.6節・決定事項No.29: 購入リストを保持し再試行できるレスポンス設計)。
    """
    menu = make_menu(price=200)
    payload = build_transaction_payload([(menu, 1)], rate_percent=10)

    original_commit = Session.commit

    def broken_commit(self, *args, **kwargs):
        raise OperationalError("commit", {}, Exception("simulated DB failure"))

    monkeypatch.setattr(Session, "commit", broken_commit)
    failed_resp = client_no_raise.post("/api/transactions", json=payload, headers=general_headers)
    assert failed_resp.status_code == 500
    assert failed_resp.json()["error_code"] == "INTERNAL_ERROR"

    monkeypatch.setattr(Session, "commit", original_commit)
    retry_resp = client_no_raise.post("/api/transactions", json=payload, headers=general_headers)
    assert retry_resp.status_code == 201
