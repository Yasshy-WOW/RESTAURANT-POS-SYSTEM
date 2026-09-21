# 簡易POSアプリ

ファミリーレストラン向けの簡易POS(レジ)システム。以下の3文書に厳密に準拠して実装しています。

- [簡易POSアプリ_要件仕様書_ドラフト.md](./簡易POSアプリ_要件仕様書_ドラフト.md)
- [簡易POSアプリ_設計仕様書.md](./簡易POSアプリ_設計仕様書.md)
- [簡易POSアプリ_テスト仕様書.md](./簡易POSアプリ_テスト仕様書.md)

## 構成

```
backend/   FastAPI (Python / Poetry) - 業務ロジック・DB・認証
frontend/  Next.js (TypeScript / npm) - 画面・BFF(リバースプロキシ)
```

ブラウザはNext.js(BFF)としか通信せず、FastAPIには直接アクセスしません(設計仕様書5.2節)。

## 前提条件

- Python 3.11 系
- [Poetry](https://python-poetry.org/)
- Node.js 20 系 / npm

ローカル開発ではDBに**SQLite**を使用します(本番はAzure Database for MySQL Flexible Serverを想定)。
SQLAlchemyの汎用型のみを使用しているため、`DATABASE_URL`を書き換えるだけで本番のMySQLへ切り替えられます。

## セットアップ

### バックエンド(backend/)

```bash
cd backend
poetry install

cp .env.example .env   # 必要に応じて値を編集

# DBスキーマを作成
poetry run alembic upgrade head

# 初期管理者(staff_id=0001)と初期消費税率(10%)を投入する(設計仕様書5.8節・決定事項No.38)
# マスタメンテナンス画面が使えるようになるまでの一度きりの例外的な手順であり、
# 2人目以降の担当者・会員・メニューはすべて画面(API)経由で登録する。
INITIAL_ADMIN_PASSWORD=<任意の初期パスワード> poetry run python scripts/seed_initial_admin.py

# 開発サーバー起動(http://localhost:8000)
poetry run uvicorn app.main:app --reload
```

テスト実行:

```bash
poetry run pytest --cov=app --cov-report=term-missing
```

### フロントエンド(frontend/)

```bash
cd frontend
npm install

cp .env.example .env.local   # BACKEND_INTERNAL_URLを必要に応じて編集

npm run dev   # http://localhost:3000
```

テスト実行:

```bash
npm run test:coverage
```

## 動作確認の流れ

1. バックエンド・フロントエンドの両方を起動する。
2. `http://localhost:3000` にアクセスし、担当者ID `0001` と、seedスクリプトで設定した
   `INITIAL_ADMIN_PASSWORD` でログインする。
3. 「消費税率管理」画面で税率を確認(初期値10%)。
4. 「メニュー管理」画面から数点メニューを登録する。
5. POSメイン画面に戻り、「お客様ID読み込み(会員なし)」→ メニュー番号入力・追加 →
   「購入」→ 確定ポップアップの表示、を一通り確認する。

## 環境変数

| ファイル | 変数 | 説明 |
|---|---|---|
| `backend/.env` | `ENV` | `local`の時のみSwagger/ReDocを公開(設計5.5節) |
| `backend/.env` | `DATABASE_URL` | DB接続文字列(開発: SQLite、本番: Azure MySQL) |
| `backend/.env` | `JWT_SECRET_KEY` | JWT署名鍵。本番は必ず変更する |
| `backend/.env` | `JWT_EXPIRE_MINUTES` | JWT有効期限(既定30分。設計5.1節) |
| `backend/.env` | `CORS_ALLOW_ORIGINS` | 許可するBFFのオリジン一覧 |
| `backend/.env` | `INITIAL_ADMIN_PASSWORD` | 初期管理者投入スクリプト用パスワード |
| `frontend/.env.local` | `BACKEND_INTERNAL_URL` | FastAPIの内部URL(ブラウザには非公開。設計5.2節) |

## CI

`.github/workflows/ci.yml` により、プルリクエスト時にバックエンド(pytest)・フロントエンド
(ESLint / Jest / ビルド)を自動実行します(テスト仕様書8.1節)。
