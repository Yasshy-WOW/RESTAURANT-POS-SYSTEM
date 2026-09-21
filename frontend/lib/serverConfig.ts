// サーバー側専用の設定。NEXT_PUBLIC_接頭辞を使わず、ブラウザ・クライアントJSバンドルには
// 一切露出させない(設計仕様書5.2節: FastAPIの実アドレスをブラウザに公開しない)。

export const BACKEND_INTERNAL_URL = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8000";

// JWTを保持するHttpOnly Cookie名(設計仕様書5.1節)
export const SESSION_COOKIE_NAME = "pos_session";
