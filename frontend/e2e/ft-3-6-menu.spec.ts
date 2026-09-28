import { test, expect, Page } from "@playwright/test";

import { requireEnv } from "./helpers";

// テスト仕様書 3.6 マスタメンテナンス(メニュー関連: FT-050, 061〜066, 076, 079)

const ADMIN_STAFF_ID = "0001";
const ADMIN_PASSWORD = requireEnv("E2E_ADMIN_PASSWORD");

async function login(page: Page, staffId: string, password: string) {
  await page.goto("/login");
  await page.locator("#staffId").fill(staffId);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "ログイン" }).click();
}

async function loginAsAdmin(page: Page) {
  await login(page, ADMIN_STAFF_ID, ADMIN_PASSWORD);
  await expect(page).toHaveURL(/\/pos$/);
  await page.goto("/admin/menus");
  await expect(page).toHaveURL(/\/admin\/menus$/);
}

async function fillMenuForm(page: Page, name: string, price: string) {
  const form = page.locator("form").first();
  await form.locator("input").nth(0).fill(name);
  await form.locator("input").nth(1).fill(price);
  await form.getByRole("button", { name: "登録", exact: true }).click();
}

async function createMenuViaApi(page: Page, name: string, price: number): Promise<string> {
  const res = await page.request.post("/api/menus", { data: { name, price } });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { menuNo: string };
  return body.menuNo;
}

test("FT-050 管理者がメニューを新規登録する(自動採番)", async ({ page }) => {
  await loginAsAdmin(page);
  const name = `FT050メニュー${Date.now()}`;
  const createResponse = page.waitForResponse(
    (res) => res.url().includes("/api/menus") && res.request().method() === "POST"
  );
  await fillMenuForm(page, name, "120");
  const res = await createResponse;
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { menuNo: string };
  expect(body.menuNo).toMatch(/^\d{4}$/);
});

test("FT-061 メニュー単価に0円を入力すると登録できない", async ({ page }) => {
  await loginAsAdmin(page);
  await fillMenuForm(page, `FT061メニュー${Date.now()}`, "0");
  await expect(page.locator("form p.text-red-600")).toHaveText("単価は1円以上で入力してください。");
});

test("FT-062 メニュー単価に負の値を入力すると登録できない", async ({ page }) => {
  await loginAsAdmin(page);
  await fillMenuForm(page, `FT062メニュー${Date.now()}`, "-100");
  await expect(page.locator("form p.text-red-600")).toHaveText("単価は1円以上で入力してください。");
});

test("FT-063 メニュー単価に境界値1円を入力すると登録できる", async ({ page }) => {
  await loginAsAdmin(page);
  const createResponse = page.waitForResponse(
    (res) => res.url().includes("/api/menus") && res.request().method() === "POST"
  );
  await fillMenuForm(page, `FT063メニュー${Date.now()}`, "1");
  const res = await createResponse;
  expect(res.status()).toBe(201);
});

test("FT-064 メニュー名を未入力で登録できない", async ({ page }) => {
  await loginAsAdmin(page);
  await fillMenuForm(page, "", "100");
  await expect(page.locator("form p.text-red-600")).toHaveText("メニュー名を入力してください。");
});

test("FT-065 メニュー名を50文字で登録できる", async ({ page }) => {
  await loginAsAdmin(page);
  const name = "あ".repeat(50);
  const createResponse = page.waitForResponse(
    (res) => res.url().includes("/api/menus") && res.request().method() === "POST"
  );
  await fillMenuForm(page, name, "100");
  const res = await createResponse;
  expect(res.status()).toBe(201);
});

test("FT-066 メニュー名を51文字で登録できない", async ({ page }) => {
  await loginAsAdmin(page);
  const name = "あ".repeat(51);
  await fillMenuForm(page, name, "100");
  await expect(page.locator("form p.text-red-600")).toHaveText("メニュー名は50文字以内で入力してください。");
});

test("FT-076 管理者がメニューの単価を編集する", async ({ page }) => {
  await loginAsAdmin(page);
  const name = `FT076メニュー${Date.now()}`;
  const menuNo = await createMenuViaApi(page, name, 150);
  await page.reload();

  const row = page.locator(`table tbody tr:has(td:text-is("${menuNo}"))`);
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "編集" }).click();
  await row.locator('input[inputmode="numeric"]').fill("180");
  await row.getByRole("button", { name: "保存" }).click();

  await expect(row.locator("td").nth(2)).toHaveText("180円");
});

test("FT-079 論理削除済みのメニュー番号を手入力するとエラーになる", async ({ page }) => {
  await loginAsAdmin(page);
  const name = `FT079メニュー${Date.now()}`;
  const menuNo = await createMenuViaApi(page, name, 100);
  const delRes = await page.request.delete(`/api/menus/${menuNo}`);
  expect(delRes.status()).toBe(204);

  await page.goto("/pos");
  await page.getByRole("button", { name: "お客様ID読み込み(会員なし)" }).click();
  await page.getByPlaceholder("メニュー番号(4桁)").fill(menuNo);
  await page.getByRole("button", { name: "読み込み" }).click();

  const menuSection = page.locator("section", { hasText: "メニュー登録" }).first();
  await expect(menuSection.locator("p.text-red-600")).toBeVisible();
});
