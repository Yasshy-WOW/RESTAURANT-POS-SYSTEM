"""初期管理者アカウントの投入(設計仕様書5.8節・決定事項No.38)。

マスタメンテナンス画面は管理者のみ利用可能だが、システム稼働開始時点では
担当者が1人も存在しないため、画面経由での最初の管理者登録ができない
(鶏と卵の問題)。この例外的な初期投入に限り、APIやマスタメンテ画面を経由せず
DBへ直接INSERTすることが認められている。

冪等性: staff_id=0001が既に存在する場合は何もしない(再実行してもエラーにならない)。

あわせて、消費税率の初期値10%(決定事項No.3)もこのタイミングで投入する。
消費税率は担当者と異なりマスタメンテ画面(POST /tax-rate)で後からいつでも
変更できる通常のデータだが、システム起動直後から一般担当者が取引を行える
ようにするには開始時点で何らかの値が存在している必要があるため、
初期管理者と同様にこのスクリプトで一度だけ投入する。
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.security import hash_password  # noqa: E402
from app.db.base import Base, SessionLocal, engine  # noqa: E402
from app.models.staff import Staff, StaffRole  # noqa: E402
from app.models.tax_rate import TaxRate  # noqa: E402

INITIAL_ADMIN_STAFF_ID = 1  # ゼロ埋めすると "0001"
INITIAL_TAX_RATE_PERCENT = 10


def seed() -> None:
    Base.metadata.create_all(bind=engine)

    password = os.environ.get("INITIAL_ADMIN_PASSWORD")
    if not password:
        raise RuntimeError("環境変数 INITIAL_ADMIN_PASSWORD が設定されていません。")

    db = SessionLocal()
    try:
        if db.get(Staff, INITIAL_ADMIN_STAFF_ID) is None:
            admin = Staff(
                staff_id=INITIAL_ADMIN_STAFF_ID,
                password_hash=hash_password(password),
                role=StaffRole.ADMIN,
                is_active=True,
            )
            db.add(admin)
            print(f"初期管理者(staff_id={INITIAL_ADMIN_STAFF_ID:04d})を投入しました。")
        else:
            print(f"staff_id={INITIAL_ADMIN_STAFF_ID:04d} は既に存在するためスキップしました。")

        if db.query(TaxRate).count() == 0:
            db.add(TaxRate(rate_percent=INITIAL_TAX_RATE_PERCENT))
            print(f"初期消費税率({INITIAL_TAX_RATE_PERCENT}%)を投入しました。")
        else:
            print("消費税率は既に登録されているためスキップしました。")

        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    seed()
