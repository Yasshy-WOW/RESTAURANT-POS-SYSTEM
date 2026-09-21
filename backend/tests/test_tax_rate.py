from tests.helpers import build_transaction_payload


def test_update_tax_rate_does_not_affect_past_transactions(
    client, admin_headers, general_headers, make_menu, tax_rate
):
    """BE-019: 税率変更後も過去の取引記録の税額が変わらない(決定事項No.12)。"""
    menu = make_menu(price=1100)
    payload = build_transaction_payload([(menu, 1)], rate_percent=10)

    create_resp = client.post("/api/transactions", json=payload, headers=general_headers)
    assert create_resp.status_code == 201
    transaction_id = create_resp.json()["transactionId"]
    original_without_tax = create_resp.json()["totalWithoutTax"]

    # 税率を10%->8%に変更
    rate_resp = client.post("/api/tax-rate", json={"ratePercent": 8}, headers=admin_headers)
    assert rate_resp.status_code == 201

    get_resp = client.get(f"/api/transactions/{transaction_id}", headers=admin_headers)
    assert get_resp.status_code == 200
    body = get_resp.json()
    assert body["taxRatePercentSnapshot"] == 10
    assert body["totalAmountWithoutTax"] == original_without_tax

    # 以降の消費税率取得は新しい値になっている
    current_resp = client.get("/api/tax-rate", headers=general_headers)
    assert current_resp.json()["ratePercent"] == 8


def test_update_tax_rate_out_of_range_rejected(client, admin_headers):
    """BE-021: -1や101など範囲外の値は422で拒否される(決定事項No.30)。"""
    for value in [-1, 101]:
        resp = client.post("/api/tax-rate", json={"ratePercent": value}, headers=admin_headers)
        assert resp.status_code == 422
        assert resp.json()["error_code"] == "VALIDATION_ERROR"


def test_update_tax_rate_boundary_0_and_100_accepted(client, admin_headers):
    """BE-022: 0と100はどちらも正常に登録できる(決定事項No.30: 上下限)。"""
    for value in [0, 100]:
        resp = client.post("/api/tax-rate", json={"ratePercent": value}, headers=admin_headers)
        assert resp.status_code == 201


def test_update_tax_rate_rejects_decimal(client, admin_headers):
    """BE-038: 8.5のような小数点を含む値は拒否される(決定事項No.37)。"""
    resp = client.post("/api/tax-rate", json={"ratePercent": 8.5}, headers=admin_headers)
    assert resp.status_code == 422
    assert resp.json()["error_code"] == "VALIDATION_ERROR"


def test_general_staff_cannot_update_tax_rate(client, general_headers):
    """決定事項No.10関連: 一般担当者は消費税率を変更できない。"""
    resp = client.post("/api/tax-rate", json={"ratePercent": 8}, headers=general_headers)
    assert resp.status_code == 403
