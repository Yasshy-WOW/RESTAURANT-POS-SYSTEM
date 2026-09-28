import { test, expect, Page } from "@playwright/test";

import { requireEnv } from "./helpers";

// テスト仕様書 3.6 マスタメンテナンス(消費税率関連: FT-056〜060, 084)
// 消費税率はアプリ全体に影響するグローバル設定のため、各テスト終了時に必ず10%へ戻す。

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
  await page.goto("/admin/tax-rate");
  await expect(page).toHaveURL(/\/admin\/tax-rate$/);
}

async function setTaxRate(page: Page, value: string) {
  const input = page.locator('input[inputmode="numeric"]');
  await input.fill(value);
  await page.getByRole("button", { name: "変更" }).click();
}

test("FT-057 消費税率に-1%を入力すると登録できない", async ({ page }) => {
  await loginAsAdmin(page);
  await setTaxRate(page, "-1");
  await expect(page.getByText("消費税率は0%以上で入力してください。")).toBeVisible();
  await expect(page.getByText("現在の消費税率: 10%")).toBeVisible();
});

test("FT-058 消費税率に101%を入力すると登録できない", async ({ page }) => {
  await loginAsAdmin(page);
  await setTaxRate(page, "101");
  await expect(page.getByText("消費税率は100%以下で入力してください。")).toBeVisible();
  await expect(page.getByText("現在の消費税率: 10%")).toBeVisible();
});

test("FT-084 消費税率に小数点を含む値(8.5%)を入力すると登録できない", async ({ page }) => {
  await loginAsAdmin(page);
  await setTaxRate(page, "8.5");
  await expect(
    page.getByText("消費税率は整数(%)で入力してください。小数点以下は指定できません。")
  ).toBeVisible();
  await expect(page.getByText("現在の消費税率: 10%")).toBeVisible();
});

test("FT-059/FT-060/FT-056 消費税率の境界値0%・100%・通常変更が反映される", async ({ page }) => {
  await loginAsAdmin(page);

  // FT-059: 下限0%
  await setTaxRate(page, "0");
  await expect(page.getByText("現在の消費税率: 0%")).toBeVisible();

  // FT-060: 上限100%
  await setTaxRate(page, "100");
  await expect(page.getByText("現在の消費税率: 100%")).toBeVisible();

  // FT-056: 通常の変更(10%->8%)が反映され、以降の取引に適用される
  await setTaxRate(page, "8");
  await expect(page.getByText("現在の消費税率: 8%")).toBeVisible();
  const rateRes = await page.request.get("/api/tax-rate");
  const rateBody = await rateRes.json();
  expect(rateBody.ratePercent).toBe(8);

  // 後続テストに影響しないよう10%に戻す
  await setTaxRate(page, "10");
  await expect(page.getByText("現在の消費税率: 10%")).toBeVisible();
});
