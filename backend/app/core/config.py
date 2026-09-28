from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """アプリケーション設定。環境変数から読み込む(設計仕様書 5.1/5.5/5.8節)。"""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # 実行環境。"local"の時のみSwagger/ReDocを有効化する(設計5.5)
    env: str = "local"

    # Azure Database for MySQL Flexible Server(gen12-mysql-pos)の接続文字列。.envで必ず指定する
    # (誤って別のDBに接続しないよう、コード側にダミーの既定値は持たせない)
    database_url: str

    # JWT設定(設計5.1)。本番はKey Vault/環境変数で必ず上書きすること
    jwt_secret_key: str = "CHANGE_ME_IN_PRODUCTION_this_key_must_be_at_least_32_bytes_long"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 30

    # CORS(設計5.3)。ワイルドカードは使用しない
    cors_allow_origins: list[str] = ["http://localhost:3000"]

    # 初期管理者投入用(設計5.8/決定事項No.38)
    initial_admin_password: str | None = None


settings = Settings()
