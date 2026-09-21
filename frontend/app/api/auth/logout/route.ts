import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { BACKEND_INTERNAL_URL, SESSION_COOKIE_NAME } from "@/lib/serverConfig";

/**
 * ログアウトBFF(要件3.1節・決定事項No.17、設計5.1節)。
 * JWTのサーバー側強制失効は行わず、BFFがCookieを破棄することで実現する。
 */
export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    try {
      await fetch(`${BACKEND_INTERNAL_URL}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // バックエンドへの通知に失敗しても、Cookie破棄によるログアウト自体は続行する
    }
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
  // 204は本文を持てないため(Responseコンストラクタが例外を投げる)、bodyはnullにする
  return new NextResponse(null, { status: 204 });
}
