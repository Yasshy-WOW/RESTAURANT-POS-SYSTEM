import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import PosPage from "@/app/pos/page";

jest.mock("@/components/AppHeader", () => ({ AppHeader: () => null }));
jest.mock("@/components/AuthGuard", () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock("@/components/BarcodeScanner", () => ({ BarcodeScanner: () => null }));

function mockBackend() {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.includes("/api/tax-rate")) {
      return {
        status: 200,
        ok: true,
        text: async () => JSON.stringify({ ratePercent: 10 }),
      } as Response;
    }
    if (url.includes("/api/menus/0001")) {
      return {
        status: 200,
        ok: true,
        text: async () => JSON.stringify({ menuNo: "0001", name: "テストメニュー", price: 100 }),
      } as Response;
    }
    if (url.includes("/api/transactions")) {
      return {
        status: 500,
        ok: false,
        text: async () => JSON.stringify({ error_code: "INTERNAL_ERROR", message: "サーバー内部でエラーが発生しました。" }),
      } as Response;
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as unknown as typeof fetch;
}

test("FE-014: 購入確定APIがエラーを返した場合、エラーポップアップを表示し購入リストのstateを保持する", async () => {
  mockBackend();
  const user = userEvent.setup();

  render(<PosPage />);

  // 会員なしで進める
  await user.click(await screen.findByText("お客様ID読み込み(会員なし)"));

  // メニューを検索してカートに追加
  const menuInput = screen.getByPlaceholderText("メニュー番号(4桁)");
  await user.type(menuInput, "0001");
  await user.click(screen.getByText("読み込み"));

  await screen.findByText("テストメニュー");
  await user.click(screen.getByText("購入リストへ追加"));

  // カートに追加されたことを確認
  expect(await screen.findAllByText("テストメニュー")).not.toHaveLength(0);

  // 購入確定 -> サーバーエラー
  await user.click(screen.getByText("購入"));

  await waitFor(() => {
    expect(screen.getByText("サーバー内部でエラーが発生しました。")).toBeInTheDocument();
  });

  // エラー後も購入リストの内容はクリアされず保持されている(決定事項No.29)
  expect(screen.getAllByText("テストメニュー").length).toBeGreaterThan(0);
});
