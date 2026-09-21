import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { BACKEND_INTERNAL_URL, SESSION_COOKIE_NAME } from "@/lib/serverConfig";

/**
 * 汎用リバースプロキシ(設計仕様書5.2節)。
 * ブラウザはFastAPIに直接アクセスせず、必ずこのBFFを経由する。
 * CookieのJWTを取り出し、Authorization: Bearerヘッダを付与してFastAPIへ転送する。
 */
async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  const targetUrl = new URL(`/api/${path.join("/")}`, BACKEND_INTERNAL_URL);
  targetUrl.search = request.nextUrl.search;

  const headers: Record<string, string> = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let body: string | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    const text = await request.text();
    if (text) {
      body = text;
      headers["Content-Type"] = "application/json";
    }
  }

  const backendResponse = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
  });

  if (backendResponse.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const responseText = await backendResponse.text();
  return new NextResponse(responseText, {
    status: backendResponse.status,
    headers: { "Content-Type": backendResponse.headers.get("Content-Type") ?? "application/json" },
  });
}

type RouteParams = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxy(request, path);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxy(request, path);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxy(request, path);
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxy(request, path);
}
