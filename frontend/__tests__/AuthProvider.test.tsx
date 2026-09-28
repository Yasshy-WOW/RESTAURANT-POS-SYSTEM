import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { apiClient, setAuthExpiredHandler } from "@/lib/apiClient";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

function TestConsumer() {
  const { auth, loading, login, logout } = useAuth();
  return (
    <div>
      <p>loading: {String(loading)}</p>
      <p>auth: {auth ? `${auth.staffId}/${auth.role}` : "none"}</p>
      <button onClick={() => login("0001", "password")}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

function mockFetchSequence(handlers: Record<string, () => Response>) {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const key of Object.keys(handlers)) {
      if (url.includes(key)) return handlers[key]();
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as unknown as typeof fetch;
}

function jsonResponse(status: number, body: unknown): Response {
  return { status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(body) } as Response;
}

afterEach(() => {
  setAuthExpiredHandler(null);
  jest.restoreAllMocks();
  mockPush.mockClear();
});

test("マウント時、Cookieが有効なら/api/auth/meでログイン状態を復元する", async () => {
  mockFetchSequence({
    "/api/auth/me": () => jsonResponse(200, { staffId: "0001", role: "ADMIN" }),
  });

  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );

  await waitFor(() => expect(screen.getByText("auth: 0001/ADMIN")).toBeInTheDocument());
  expect(screen.getByText("loading: false")).toBeInTheDocument();
});

test("マウント時、Cookieが無効なら未ログイン状態のままになる", async () => {
  mockFetchSequence({
    "/api/auth/me": () => jsonResponse(401, { error_code: "AUTH_INVALID_CREDENTIALS", message: "unauthorized" }),
  });

  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );

  await waitFor(() => expect(screen.getByText("loading: false")).toBeInTheDocument());
  expect(screen.getByText("auth: none")).toBeInTheDocument();
});

test("login()はログインAPIと/api/auth/meを呼び、認証状態をセットする", async () => {
  const user = userEvent.setup();
  mockFetchSequence({
    "/api/auth/login": () => jsonResponse(200, { token: "dummy" }),
    "/api/auth/me": () => jsonResponse(200, { staffId: "0001", role: "ADMIN" }),
  });

  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );
  await waitFor(() => expect(screen.getByText("loading: false")).toBeInTheDocument());

  await user.click(screen.getByText("login"));
  await waitFor(() => expect(screen.getByText("auth: 0001/ADMIN")).toBeInTheDocument());
});

test("logout()はログアウトAPIを呼び、認証状態をクリアしてログイン画面へ遷移する", async () => {
  const user = userEvent.setup();
  mockFetchSequence({
    "/api/auth/me": () => jsonResponse(200, { staffId: "0001", role: "ADMIN" }),
    "/api/auth/logout": () => jsonResponse(204, undefined),
  });

  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );
  await waitFor(() => expect(screen.getByText("auth: 0001/ADMIN")).toBeInTheDocument());

  await user.click(screen.getByText("logout"));
  await waitFor(() => expect(screen.getByText("auth: none")).toBeInTheDocument());
  expect(mockPush).toHaveBeenCalledWith("/login");
});

test("FE-013連携: JWT期限切れハンドラが発火すると認証状態をクリアしてログイン画面へ遷移する(決定事項No.28)", async () => {
  mockFetchSequence({
    "/api/auth/me": () => jsonResponse(200, { staffId: "0001", role: "ADMIN" }),
  });

  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );
  await waitFor(() => expect(screen.getByText("auth: 0001/ADMIN")).toBeInTheDocument());

  // AuthProviderはマウント時にsetAuthExpiredHandlerでこのコールバックをapiClientへ登録している。
  // 他のAPI呼び出しがAUTH_TOKEN_EXPIREDを受け取った状況を再現し、登録が効いているか確認する。
  mockFetchSequence({
    "/api/whatever": () =>
      jsonResponse(401, { error_code: "AUTH_TOKEN_EXPIRED", message: "セッションの有効期限が切れました。" }),
  });
  await expect(apiClient.get("/api/whatever")).rejects.toThrow();

  await waitFor(() => expect(screen.getByText("auth: none")).toBeInTheDocument());
  expect(mockPush).toHaveBeenCalledWith("/login");
});
