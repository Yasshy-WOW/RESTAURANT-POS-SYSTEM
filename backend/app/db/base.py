from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

if settings.database_url.startswith("sqlite"):
    # SQLiteはデフォルトでスレッドチェックを行うため、FastAPIの依存性注入と組み合わせるために無効化する。
    connect_args = {"check_same_thread": False}
elif settings.database_url.startswith("mysql"):
    # Azure Database for MySQL Flexible Serverは既定でTLSを必須とする(require_secure_transport=ON)。
    # PyMySQLにTLSを有効化させる(空dictでも暗号化は有効になる。CA検証はAzureの公開CA証明書を
    # 明示的に指定していないため行わないが、通信自体は暗号化される)。
    connect_args = {"ssl": {}}
else:
    connect_args = {}

engine = create_engine(settings.database_url, connect_args=connect_args, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
