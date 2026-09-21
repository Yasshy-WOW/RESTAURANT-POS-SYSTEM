def test_sql_injection_attempt_is_safely_rejected(client, general_headers):
    """BE-026: SQLインジェクション文字列を含む入力が、パラメータ化クエリ等により
    安全に処理される(想定外のデータ漏洩・エラーが起きない)。

    担当者ID・会員IDはPydantic/parse_idの桁数・数字チェックを通るため、
    SQLインジェクション文字列はDBに到達する前にVALIDATION_ERRORとして拒否される。
    """
    login_resp = client.post(
        "/api/auth/login", json={"staffId": "' OR '1'='1", "password": "x"}
    )
    assert login_resp.status_code == 422
    assert login_resp.json()["error_code"] == "VALIDATION_ERROR"

    member_resp = client.get("/api/members/1' OR '1'='1", headers=general_headers)
    assert member_resp.status_code == 422
    assert member_resp.json()["error_code"] == "VALIDATION_ERROR"


def test_xss_payload_is_escaped_on_output(client, admin_headers):
    """BE-027: <script>等を含む登録内容が、そのままスクリプトとして解釈されず、
    文字列としてAPIレスポンスに正しく格納・返却される
    (HTMLへの埋め込み時のエスケープ表示はフロントエンド側の責務。FE-018で検証)。
    """
    payload_name = "<script>alert(1)</script>"
    create_resp = client.post("/api/menus", json={"name": payload_name, "price": 100}, headers=admin_headers)
    assert create_resp.status_code == 201
    menu_no = create_resp.json()["menuNo"]

    list_resp = client.get("/api/menus", headers=admin_headers)
    created = next(m for m in list_resp.json()["menus"] if m["menuNo"] == menu_no)
    assert created["name"] == payload_name
