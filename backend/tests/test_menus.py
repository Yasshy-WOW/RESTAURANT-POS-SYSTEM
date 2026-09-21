from app.services.numbering import MENU_NO_WIDTH, format_id


def test_get_menu_success(client, general_headers, make_menu):
    """BE-006: 存在するメニュー番号で名称・単価が返る。"""
    menu = make_menu(name="ハンバーグ定食", price=980)
    menu_no = format_id(menu.menu_no, MENU_NO_WIDTH)
    resp = client.get(f"/api/menus/{menu_no}", headers=general_headers)
    assert resp.status_code == 200
    assert resp.json() == {"menuNo": menu_no, "name": "ハンバーグ定食", "price": 980}


def test_get_menu_not_found(client, general_headers):
    """BE-007: 存在しないメニュー番号で404が返る。"""
    resp = client.get("/api/menus/0999", headers=general_headers)
    assert resp.status_code == 404
    assert resp.json()["error_code"] == "MENU_NOT_FOUND"


def test_get_soft_deleted_menu_returns_not_found(client, general_headers, make_menu):
    """BE-034: 論理削除済みのメニュー番号は「存在しない」と同様に404が返る。"""
    menu = make_menu(is_active=False)
    menu_no = format_id(menu.menu_no, MENU_NO_WIDTH)
    resp = client.get(f"/api/menus/{menu_no}", headers=general_headers)
    assert resp.status_code == 404
    assert resp.json()["error_code"] == "MENU_NOT_FOUND"


def test_create_menu_auto_number(client, admin_headers):
    """BE-017: メニュー番号が4桁で自動採番される。"""
    resp = client.post("/api/menus", json={"name": "新メニュー", "price": 500}, headers=admin_headers)
    assert resp.status_code == 201
    menu_no = resp.json()["menuNo"]
    assert len(menu_no) == 4
    assert menu_no.isdigit()


def test_create_menu_price_must_be_positive_integer(client, admin_headers):
    """BE-023: 0円・負の値・小数は拒否される(決定事項No.31)。"""
    for price in [0, -100]:
        resp = client.post("/api/menus", json={"name": "不正メニュー", "price": price}, headers=admin_headers)
        assert resp.status_code == 422
        assert resp.json()["error_code"] == "VALIDATION_ERROR"

    resp = client.post("/api/menus", json={"name": "不正メニュー", "price": 100.5}, headers=admin_headers)
    assert resp.status_code == 422


def test_create_menu_price_boundary_1_yen_accepted(client, admin_headers):
    """FT-063相当の境界値: 単価1円は正常に登録できる(決定事項No.31: 下限)。"""
    resp = client.post("/api/menus", json={"name": "境界メニュー", "price": 1}, headers=admin_headers)
    assert resp.status_code == 201


def test_create_menu_name_length_boundary(client, admin_headers):
    """BE-024: メニュー名は50文字は許可、51文字は拒否される(決定事項No.32)。"""
    ok_resp = client.post("/api/menus", json={"name": "あ" * 50, "price": 100}, headers=admin_headers)
    assert ok_resp.status_code == 201

    ng_resp = client.post("/api/menus", json={"name": "あ" * 51, "price": 100}, headers=admin_headers)
    assert ng_resp.status_code == 422
    assert ng_resp.json()["error_code"] == "VALIDATION_ERROR"


def test_create_menu_name_empty_rejected(client, admin_headers):
    """FT-064相当: メニュー名が未入力の場合は登録できない。"""
    resp = client.post("/api/menus", json={"name": "", "price": 100}, headers=admin_headers)
    assert resp.status_code == 422


def test_update_menu_price_success(client, admin_headers, make_menu):
    """BE-029: 単価を更新すると、以降のGETで新しい値が返る。"""
    menu = make_menu(name="固定メニュー", price=150)
    menu_no = format_id(menu.menu_no, MENU_NO_WIDTH)

    resp = client.put(f"/api/menus/{menu_no}", json={"price": 180}, headers=admin_headers)
    assert resp.status_code == 204

    get_resp = client.get(f"/api/menus/{menu_no}", headers=admin_headers)
    assert get_resp.json()["price"] == 180


def test_list_excludes_soft_deleted_by_default(client, admin_headers, make_menu):
    """BE-035(メニュー分)。"""
    make_menu(is_active=True)
    deleted = make_menu(is_active=False)
    deleted_no = format_id(deleted.menu_no, MENU_NO_WIDTH)

    resp = client.get("/api/menus", headers=admin_headers)
    numbers = [m["menuNo"] for m in resp.json()["menus"]]
    assert deleted_no not in numbers


def test_list_includes_soft_deleted_when_requested(client, admin_headers, make_menu):
    """BE-036(メニュー分)。"""
    deleted = make_menu(is_active=False)
    deleted_no = format_id(deleted.menu_no, MENU_NO_WIDTH)

    resp = client.get("/api/menus?includeDeleted=true", headers=admin_headers)
    numbers = [m["menuNo"] for m in resp.json()["menus"]]
    assert deleted_no in numbers


def test_restore_soft_deleted_menu(client, admin_headers, general_headers, make_menu):
    """BE-037(メニュー分)。"""
    menu = make_menu(is_active=False)
    menu_no = format_id(menu.menu_no, MENU_NO_WIDTH)

    resp = client.put(f"/api/menus/{menu_no}", json={"isActive": True}, headers=admin_headers)
    assert resp.status_code == 204

    get_resp = client.get(f"/api/menus/{menu_no}", headers=general_headers)
    assert get_resp.status_code == 200


def test_delete_menu_requires_confirmation_flow_is_soft_delete(client, admin_headers, make_menu):
    """決定事項No.25関連: 削除は論理削除であり、is_active=Falseになる。"""
    menu = make_menu()
    menu_no = format_id(menu.menu_no, MENU_NO_WIDTH)

    resp = client.delete(f"/api/menus/{menu_no}", headers=admin_headers)
    assert resp.status_code == 204

    get_resp = client.get(f"/api/menus/{menu_no}", headers=admin_headers)
    assert get_resp.status_code == 404
