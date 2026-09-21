import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { BACKEND_INTERNAL_URL, SESSION_COOKIE_NAME } from "@/lib/serverConfig";

/**
 * ログインBFF(設計仕様書4.1節・5.1節)。
 * JWT本体はJSに公開せず、HttpOnly; Secure; SameSite=Strict Cookieにのみ格納する。
 * ブラウザへは画面表示に必要なrole/staffIdのみを返す。
 */
export async function POST(request: NextRequest) {
  const body = await request.json();

  const backendResponse = await fetch(`${BACKEND_INTERNAL_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await backendResponse.json();

  if (!backendResponse.ok) {
    return NextResponse.json(data, { status: backendResponse.status });
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    // JWT有効期限(30分。設計仕様書5.1節)とCookie寿命を一致させる
    maxAge: 30 * 60,
  });

  return NextResponse.json({ role: data.role });
}
