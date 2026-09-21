import { apiClient, ApiError, setAuthExpiredHandler } from "@/lib/apiClient";

function mockFetchOnce(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(body),
  }) as unknown as typeof fetch;
}

afterEach(() => {
  setAuthExpiredHandler(null);
  jest.restoreAllMocks();
});

test("FE-013: トークン期限切れのレスポンスを受けるとログイン画面へリダイレクトするハンドラが呼ばれる", async () => {
  const handler = jest.fn();
  setAuthExpiredHandler(handler);
  mockFetchOnce(401, { error_code: "AUTH_TOKEN_EXPIRED", message: "期限切れ" });

  await expect(apiClient.get("/api/pos/whatever")).rejects.toThrow(ApiError);
  expect(handler).toHaveBeenCalledTimes(1);
});

test("認証エラー以外(例: 404)ではハンドラは呼ばれない", async () => {
  const handler = jest.fn();
  setAuthExpiredHandler(handler);
  mockFetchOnce(404, { error_code: "MENU_NOT_FOUND", message: "見つかりません" });

  await expect(apiClient.get("/api/menus/0999")).rejects.toThrow(ApiError);
  expect(handler).not.toHaveBeenCalled();
});
