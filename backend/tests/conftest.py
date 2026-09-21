import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token, hash_password
from app.db.base import Base, get_db
from app.main import app
from app.models.menu import Menu
from app.models.staff import Staff, StaffRole
from app.models.tax_rate import TaxRate
from app.services.numbering import MENU_NO_WIDTH, STAFF_ID_WIDTH, format_id

DEFAULT_PASSWORD = "password123"
DEFAULT_TAX_RATE = 10


@pytest.fixture()
def engine():
    """テストごとに独立したインメモリSQLite。StaticPoolで単一コネクションを共有し、
    複数セッション(=複数APIリクエストを模した各get_db呼び出し)から同じデータが見えるようにする。
    """
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=eng)
    yield eng
    Base.metadata.drop_all(bind=eng)
    eng.dispose()


@pytest.fixture()
def session_factory(engine):
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture()
def db_session(session_factory):
    """テストデータの直接準備用セッション(APIを介さないセットアップ)。"""
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(session_factory):
    """本番のget_db()と同様、リクエストごとに新しいセッションを払い出す(BE-020の
    再試行シナリオを正しく再現するため、テスト全体で1つのセッションを使い回さない)。
    """

    def override_get_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def client_no_raise(session_factory):
    """BE-020用: 想定外のサーバー例外をTestClientが再送出せず、実際のHTTPレスポンス
    (500 + INTERNAL_ERROR)としてそのまま検証できるクライアント
    (raise_server_exceptions=False。Starletteの既定はテスト中にサーバー例外を
    そのまま再送出するため、意図的に500を発生させるこのテストでのみ無効化する)。
    """

    def override_get_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, raise_server_exceptions=False) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _create_staff(db_session, role: StaffRole, password: str = DEFAULT_PASSWORD, is_active: bool = True) -> Staff:
    staff = Staff(password_hash=hash_password(password), role=role, is_active=is_active)
    db_session.add(staff)
    db_session.commit()
    db_session.refresh(staff)
    return staff


@pytest.fixture()
def make_staff(db_session):
    """任意のロール・パスワードで担当者を作成するファクトリ。"""

    def _make(role: StaffRole = StaffRole.GENERAL, password: str = DEFAULT_PASSWORD, is_active: bool = True) -> Staff:
        return _create_staff(db_session, role, password, is_active)

    return _make


@pytest.fixture()
def admin_staff(db_session) -> Staff:
    return _create_staff(db_session, StaffRole.ADMIN)


@pytest.fixture()
def general_staff(db_session) -> Staff:
    return _create_staff(db_session, StaffRole.GENERAL)


def _auth_header(staff: Staff) -> dict[str, str]:
    token = create_access_token(staff_id=format_id(staff.staff_id, STAFF_ID_WIDTH), role=staff.role.value)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def auth_header():
    return _auth_header


@pytest.fixture()
def admin_headers(admin_staff) -> dict[str, str]:
    return _auth_header(admin_staff)


@pytest.fixture()
def general_headers(general_staff) -> dict[str, str]:
    return _auth_header(general_staff)


@pytest.fixture()
def make_menu(db_session):
    """メニューを作成するファクトリ(既定: 価格100円・有効)。"""

    def _make(name: str = "テストメニュー", price: int = 100, is_active: bool = True) -> Menu:
        menu = Menu(name=name, price=price, is_active=is_active)
        db_session.add(menu)
        db_session.commit()
        db_session.refresh(menu)
        return menu

    return _make


@pytest.fixture()
def tax_rate(db_session) -> TaxRate:
    """消費税率10%を投入する(決定事項No.3)。"""
    rate = TaxRate(rate_percent=DEFAULT_TAX_RATE)
    db_session.add(rate)
    db_session.commit()
    db_session.refresh(rate)
    return rate


def menu_no_str(menu: Menu) -> str:
    return format_id(menu.menu_no, MENU_NO_WIDTH)
