from logging.config import fileConfig

from alembic import context

from app.core.config import settings
from app.db.base import Base, engine
from app import models  # noqa: F401  モデルをmetadataに登録するために読み込む

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# 注意: config.set_main_option("sqlalchemy.url", ...) は使わない。
# ConfigParserは値の中の"%"を補間構文として解釈するため、パスワードに"%40"のような
# URLエンコード済み文字列が含まれるとValueErrorになる。そのためsqlalchemy.urlはini経由で
# 保持せず、app.db.base.engine(接続文字列・SSL設定込みで生成済み)をそのまま再利用する。

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    with engine.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
