from app.models.staff import StaffRole
from tests.conftest import DEFAULT_PASSWORD


def test_login_success(client, general_staff):
    """BE-001: 正しいID・パスワードでJWTが返る。"""
    staff_id = f"{general_staff.staff_id:04d}"
    resp = client.post("/api/auth/login", json={"staffId": staff_id, "password": DEFAULT_PASSWORD})
    assert resp.status_code == 200
    body = resp.json()
    assert body["token"]
    assert body["role"] == "GENERAL"


def test_login_wrong_password(client, general_staff):
    """BE-002: パスワード誤りで401が返る。"""
    staff_id = f"{general_staff.staff_id:04d}"
    resp = client.post("/api/auth/login", json={"staffId": staff_id, "password": "wrong-password"})
    assert resp.status_code == 401
    assert resp.json()["error_code"] == "AUTH_INVALID_CREDENTIALS"


def test_login_unknown_staff_id(client):
    """BE-003: 存在しない担当者IDで401が返る。"""
    resp = client.post("/api/auth/login", json={"staffId": "9999", "password": "whatever"})
    assert resp.status_code == 401
    assert resp.json()["error_code"] == "AUTH_INVALID_CREDENTIALS"


def test_login_with_soft_deleted_staff_rejected(client, make_staff):
    """BE-032: is_active=Falseの担当者はログインできない。"""
    staff = make_staff(role=StaffRole.GENERAL, is_active=False)
    resp = client.post(
        "/api/auth/login", json={"staffId": f"{staff.staff_id:04d}", "password": DEFAULT_PASSWORD}
    )
    assert resp.status_code == 401
    assert resp.json()["error_code"] == "AUTH_INVALID_CREDENTIALS"


def test_me_returns_current_staff(client, general_staff, general_headers):
    resp = client.get("/api/auth/me", headers=general_headers)
    assert resp.status_code == 200
    assert resp.json()["staffId"] == f"{general_staff.staff_id:04d}"
    assert resp.json()["role"] == "GENERAL"


def test_logout_returns_no_content(client, general_headers):
    """FT-005相当: ログアウト操作が204を返す。"""
    resp = client.post("/api/auth/logout", headers=general_headers)
    assert resp.status_code == 204
