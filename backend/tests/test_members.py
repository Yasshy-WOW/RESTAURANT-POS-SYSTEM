from app.models.member import Gender, Member
from app.services.numbering import MEMBER_ID_WIDTH, format_id

MEMBER_PAYLOAD = {
    "name": "山田太郎",
    "phone": "090-1234-5678",
    "address": "東京都渋谷区1-1-1",
    "gender": "MALE",
    "age": 30,
}


def _make_member(db_session, is_active: bool = True) -> Member:
    member = Member(
        name="テスト会員",
        phone="0312345678",
        address="東京都",
        gender=Gender.FEMALE,
        age=25,
        is_active=is_active,
    )
    db_session.add(member)
    db_session.commit()
    db_session.refresh(member)
    return member


def test_get_member_success(client, general_headers, db_session):
    """BE-004: 存在する会員IDで会員情報(会員IDのみ)が返る。"""
    member = _make_member(db_session)
    member_id = format_id(member.member_id, MEMBER_ID_WIDTH)
    resp = client.get(f"/api/members/{member_id}", headers=general_headers)
    assert resp.status_code == 200
    assert resp.json() == {"memberId": member_id}


def test_get_member_not_found(client, general_headers):
    """BE-005: 存在しない会員IDで404が返る。"""
    resp = client.get("/api/members/99999999", headers=general_headers)
    assert resp.status_code == 404
    assert resp.json()["error_code"] == "MEMBER_NOT_FOUND"


def test_get_soft_deleted_member_returns_not_found(client, general_headers, db_session):
    """BE-033: 論理削除済みの会員IDは「存在しない」と同様に404が返る。"""
    member = _make_member(db_session, is_active=False)
    member_id = format_id(member.member_id, MEMBER_ID_WIDTH)
    resp = client.get(f"/api/members/{member_id}", headers=general_headers)
    assert resp.status_code == 404
    assert resp.json()["error_code"] == "MEMBER_NOT_FOUND"


def test_create_member_auto_number(client, admin_headers):
    """BE-017: 会員IDが8桁で自動採番される。"""
    resp = client.post("/api/members", json=MEMBER_PAYLOAD, headers=admin_headers)
    assert resp.status_code == 201
    member_id = resp.json()["memberId"]
    assert len(member_id) == 8
    assert member_id.isdigit()


def test_update_member_success(client, admin_headers, db_session):
    """BE-030: 会員情報を更新すると、以降のGETで新しい値が返る。"""
    member = _make_member(db_session)
    member_id = format_id(member.member_id, MEMBER_ID_WIDTH)
    resp = client.put(f"/api/members/{member_id}", json={"phone": "080-9999-8888"}, headers=admin_headers)
    assert resp.status_code == 204

    list_resp = client.get("/api/members?includeDeleted=true", headers=admin_headers)
    updated = next(m for m in list_resp.json()["members"] if m["memberId"] == member_id)
    assert updated["phone"] == "080-9999-8888"


def test_list_excludes_soft_deleted_by_default(client, admin_headers, db_session):
    """BE-035(会員分): 削除済み表示パラメータ未指定時は一覧に含まれない。"""
    _make_member(db_session, is_active=True)
    deleted = _make_member(db_session, is_active=False)
    deleted_id = format_id(deleted.member_id, MEMBER_ID_WIDTH)

    resp = client.get("/api/members", headers=admin_headers)
    ids = [m["memberId"] for m in resp.json()["members"]]
    assert deleted_id not in ids


def test_list_includes_soft_deleted_when_requested(client, admin_headers, db_session):
    """BE-036(会員分): includeDeleted=trueで論理削除済みレコードも一覧に含まれる。"""
    deleted = _make_member(db_session, is_active=False)
    deleted_id = format_id(deleted.member_id, MEMBER_ID_WIDTH)

    resp = client.get("/api/members?includeDeleted=true", headers=admin_headers)
    ids = [m["memberId"] for m in resp.json()["members"]]
    assert deleted_id in ids


def test_restore_soft_deleted_member(client, admin_headers, general_headers, db_session):
    """BE-037(会員分): 復元操作によりis_activeがTrueに戻り、通常のGETで取得できる。"""
    member = _make_member(db_session, is_active=False)
    member_id = format_id(member.member_id, MEMBER_ID_WIDTH)

    resp = client.put(f"/api/members/{member_id}", json={"isActive": True}, headers=admin_headers)
    assert resp.status_code == 204

    get_resp = client.get(f"/api/members/{member_id}", headers=general_headers)
    assert get_resp.status_code == 200
    assert get_resp.json() == {"memberId": member_id}
