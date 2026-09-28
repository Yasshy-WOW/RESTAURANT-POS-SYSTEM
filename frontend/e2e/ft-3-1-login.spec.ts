import { test, expect, Page } from "@playwright/test";

// テスト仕様書 3.1 ログイン(FT-001〜FT-008)
// 既存のgen12-mysql-posデータ(担当者0001=管理者)をそのまま利用する。追加のみ行い、削除は行わない。

const ADMIN_STAFF_ID = "0001";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  throw new Error(
    "環境変数E2E_ADMIN_PASSWORDを設定してください(backend/.envのINITIAL_ADMIN_PASSWORDと同じ値)。"
  );
}

async function login(page: Page, staffId: string, password: string) {
  await page.goto("/login");
  await page.locator("#staffId").fill(staffId);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "ログイン" }).click();
}

test("FT-001 正しいID・パスワードでログイン", async ({ page }) => {
  await login(page, ADMIN_STAFF_ID, ADMIN_PASSWORD);
  await expect(page).toHaveURL(/\/pos$/);
  await expect(page.getByRole("heading", { name: "会員ID" })).toBeVisible();
});

test("FT-002 存在しない担当者IDでログイン", async ({ page }) => {
  await login(page, "9999", "whatever-password");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator("form")).toContainText(/./); // エラー文言の存在を後段でassert
  const errorText = page.locator("form p.text-red-600");
  await expect(errorText).toBeVisible();
});

test("FT-003 パスワード誤りでログイン", async ({ page }) => {
  await login(page, ADMIN_STAFF_ID, "definitely-wrong-password");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator("form p.text-red-600")).toBeVisible();
});

test("FT-004 パスワード誤りを連続10回行ってもロックされない", async ({ page }) => {
  for (let i = 0; i < 10; i++) {
    await login(page, ADMIN_STAFF_ID, `wrong-password-${i}`);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator("form p.text-red-600")).toBeVisible();
  }
  // 10回目の後でも、正しいパスワードなら普通にログインできる(アカウントロックされていないことの確認)
  await login(page, ADMIN_STAFF_ID, ADMIN_PASSWORD);
  await expect(page).toHaveURL(/\/pos$/);
});

test("FT-005 ログアウトするとログイン画面に戻る", async ({ page }) => {
  await login(page, ADMIN_STAFF_ID, ADMIN_PASSWORD);
  await expect(page).toHaveURL(/\/pos$/);
  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("FT-006/FT-007/FT-008 担当者登録(パスワード空文字/1文字)と論理削除済みログイン", async ({ page }) => {
  await login(page, ADMIN_STAFF_ID, ADMIN_PASSWORD);
  await expect(page).toHaveURL(/\/pos$/);
  await page.goto("/admin/staff");
  await expect(page).toHaveURL(/\/admin\/staff$/);

  // FT-006: パスワード空文字で登録 -> エラー
  await page.getByRole("button", { name: "登録", exact: true }).click();
  await expect(page.locator("form p.text-red-600")).toBeVisible();

  // FT-007: パスワード1文字で登録 -> 正常に登録できる(下限境界)
  const onePasswordChar = "a";
  await page.locator('input[type="password"]').first().fill(onePasswordChar);
  await page.getByRole("button", { name: "登録", exact: true }).click();

  // 一覧から新規作成された担当者ID(4桁)を特定する(自動採番のためハードコードしない)
  const rows = page.locator("table tbody tr");
  await expect(rows.first()).toBeVisible();
  const newRow = rows.filter({ hasText: "一般担当者" }).last();
  const newStaffId = await newRow.locator("td").first().innerText();
  expect(newStaffId).toMatch(/^\d{4}$/);

  // FT-008の準備: 作成した担当者をアプリの削除機能で論理削除する(is_active=false)
  await newRow.getByRole("button", { name: "削除" }).click();
  await page.getByRole("button", { name: "はい" }).click();
  await expect(page.locator("table tbody tr", { hasText: newStaffId })).toHaveCount(0);

  // FT-008: 論理削除済みの担当者IDでログインを試みる -> エラーになりログインできない
  await page.getByRole("button", { name: "ログアウト" }).click();
  await login(page, newStaffId, onePasswordChar);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator("form p.text-red-600")).toBeVisible();
});
