from app.models.staff import StaffRole
from app.services.numbering import STAFF_ID_WIDTH, format_id


def test_create_staff_auto_number(client, admin_headers):
    """BE-013: 担当者IDが自動採番される(4桁)。"""
    resp = client.post("/api/staff", json={"password": "abc12345", "role": "GENERAL"}, headers=admin_headers)
    assert resp.status_code == 201
    staff_id = resp.json()["staffId"]
    assert len(staff_id) == 4
    assert staff_id.isdigit()


def test_create_staff_empty_password_rejected(client, admin_headers):
    """BE-025: 空文字のパスワードは拒否される(決定事項No.33)。"""
    resp = client.post("/api/staff", json={"password": "", "role": "GENERAL"}, headers=admin_headers)
    assert resp.status_code == 422
    assert resp.json()["error_code"] == "VALIDATION_ERROR"


def test_create_staff_password_one_char_accepted(client, admin_headers):
    """FT-007相当の境界値: パスワード1文字は登録できる(決定事項No.33: 下限)。"""
    resp = client.post("/api/staff", json={"password": "a", "role": "GENERAL"}, headers=admin_headers)
    assert resp.status_code == 201


def test_delete_last_admin_forbidden(client, admin_headers, admin_staff):
    """BE-014: 最後の管理者は削除できない(決定事項No.22)。"""
    staff_id = format_id(admin_staff.staff_id, STAFF_ID_WIDTH)
    resp = client.delete(f"/api/staff/{staff_id}", headers=admin_headers)
    assert resp.status_code == 409
    assert resp.json()["error_code"] == "LAST_ADMIN_PROTECTION"


def test_demote_last_admin_forbidden(client, admin_headers, admin_staff):
    """BE-015: 最後の管理者は一般担当者に降格できない(決定事項No.22)。"""
    staff_id = format_id(admin_staff.staff_id, STAFF_ID_WIDTH)
    resp = client.put(f"/api/staff/{staff_id}", json={"role": "GENERAL"}, headers=admin_headers)
    assert resp.status_code == 409
    assert resp.json()["error_code"] == "LAST_ADMIN_PROTECTION"


def test_delete_staff_is_soft_delete(client, admin_headers, make_staff):
    """BE-016: 削除後もis_active=Falseでレコードが残る(論理削除)。"""
    staff = make_staff(role=StaffRole.GENERAL)
    staff_id = format_id(staff.staff_id, STAFF_ID_WIDTH)

    resp = client.delete(f"/api/staff/{staff_id}", headers=admin_headers)
    assert resp.status_code == 204

    list_resp = client.get("/api/staff?includeDeleted=true", headers=admin_headers)
    record = next(s for s in list_resp.json()["staff"] if s["staffId"] == staff_id)
    assert record["isActive"] is False


def test_general_staff_cannot_access_admin_endpoints(client, general_headers):
    """BE-018: 一般担当者トークンでマスタメンテナンス系APIを叩くと403が返る。"""
    resp = client.get("/api/staff", headers=general_headers)
    assert resp.status_code == 403
    assert resp.json()["error_code"] == "AUTH_FORBIDDEN"


def test_promote_staff_to_admin_success(client, admin_headers, make_staff):
    """BE-031: 一般担当者を管理者に昇格でき、以降マスタメンテ系APIにアクセスできる。"""
    staff = make_staff(role=StaffRole.GENERAL)
    staff_id = format_id(staff.staff_id, STAFF_ID_WIDTH)

    resp = client.put(f"/api/staff/{staff_id}", json={"role": "ADMIN"}, headers=admin_headers)
    assert resp.status_code == 204

    from app.core.security import create_access_token

    new_token = create_access_token(staff_id=staff_id, role="ADMIN")
    promoted_headers = {"Authorization": f"Bearer {new_token}"}
    list_resp = client.get("/api/staff", headers=promoted_headers)
    assert list_resp.status_code == 200


def test_list_excludes_soft_deleted_by_default(client, admin_headers, make_staff):
    """BE-035(担当者分)。"""
    deleted = make_staff(role=StaffRole.GENERAL, is_active=False)
    deleted_id = format_id(deleted.staff_id, STAFF_ID_WIDTH)

    resp = client.get("/api/staff", headers=admin_headers)
    ids = [s["staffId"] for s in resp.json()["staff"]]
    assert deleted_id not in ids


def test_list_includes_soft_deleted_when_requested(client, admin_headers, make_staff):
    """BE-036(担当者分)。"""
    deleted = make_staff(role=StaffRole.GENERAL, is_active=False)
    deleted_id = format_id(deleted.staff_id, STAFF_ID_WIDTH)

    resp = client.get("/api/staff?includeDeleted=true", headers=admin_headers)
    ids = [s["staffId"] for s in resp.json()["staff"]]
    assert deleted_id in ids


def test_restore_soft_deleted_staff(client, admin_headers, make_staff):
    """BE-037(担当者分)。"""
    deleted = make_staff(role=StaffRole.GENERAL, is_active=False)
    deleted_id = format_id(deleted.staff_id, STAFF_ID_WIDTH)

    resp = client.put(f"/api/staff/{deleted_id}", json={"isActive": True}, headers=admin_headers)
    assert resp.status_code == 204

    list_resp = client.get("/api/staff", headers=admin_headers)
    ids = [s["staffId"] for s in list_resp.json()["staff"]]
    assert deleted_id in ids
