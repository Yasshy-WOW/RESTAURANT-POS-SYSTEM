import { NextResponse } from "next/server";

/**
 * Next.js(BFF)自体の死活監視用(設計仕様書8.7節)。
 * FastAPIへは中継せず、DBアクセスも行わない。
 */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
