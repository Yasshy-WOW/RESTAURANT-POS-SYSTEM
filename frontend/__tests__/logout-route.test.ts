/**
 * @jest-environment node
 *
 * ログアウトBFFルート(app/api/auth/logout/route.ts)の回帰テスト。
 * next/serverのRequest/Response実装はNode環境が必要なため、このファイルのみ
 * jest-environment-jsdomではなくnode環境で実行する。
 * 手動疎通確認で、204レスポンスにNextResponse.json(null, {status:204})を使うと
 * 「Response constructor: Invalid response status code 204」で例外になる不具合を
 * 検出したため、正しくnew NextResponse(null, {status:204})で204を返せることを固定する。
 */

const mockDelete = jest.fn();
const mockGet = jest.fn().mockReturnValue({ value: "dummy-jwt" });

jest.mock("next/headers", () => ({
  cookies: async () => ({
    get: mockGet,
    delete: mockDelete,
  }),
}));

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 204 }) as unknown as typeof fetch;
});

test("POST /api/auth/logout は本文なしの204を返し、Cookieを破棄する", async () => {
  const { POST } = await import("@/app/api/auth/logout/route");
  const response = await POST();

  expect(response.status).toBe(204);
  expect(mockDelete).toHaveBeenCalledWith("pos_session");
});
