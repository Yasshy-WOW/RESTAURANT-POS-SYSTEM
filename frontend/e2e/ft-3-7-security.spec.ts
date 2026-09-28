import { test, expect, Page } from "@playwright/test";

import { requireEnv } from "./helpers";

// テスト仕様書 3.7 セキュリティ系異常値テスト(FT-070〜074。FT-075は3.5節で検証済み)

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
}

test("FT-070 担当者ID欄へのSQLインジェクション試行", async ({ page }) => {
  let dialogFired = false;
  page.on("dialog", () => {
    dialogFired = true;
  });

  await login(page, "' OR '1'='1", "whatever");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator("form p.text-red-600")).toBeVisible();
  expect(dialogFired).toBe(false);
});

test("FT-071 会員ID欄へのSQLインジェクション試行", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/pos");
  await page.getByPlaceholder("会員ID(8桁)").fill("1' OR '1'='1");
  await page.getByRole("button", { name: "会員ID読み込み" }).click();

  const memberSection = page.locator("section", { hasText: "会員ID" }).first();
  await expect(memberSection.locator("p.text-red-600")).toContainText("8桁");
  // 会員なしのまま先に進めていない(想定外のデータが返っていない)
  await expect(page.getByPlaceholder("会員ID(8桁)")).toBeVisible();
});

test("FT-072 メニュー名欄へのスクリプトタグ入力(XSS試行)", async ({ page }) => {
  let dialogFired = false;
  page.on("dialog", () => {
    dialogFired = true;
  });

  await loginAsAdmin(page);
  const name = `<script>alert(1)</script>${Date.now()}`;
  // 登録自体はAPI経由(管理画面一覧はlimit=100超のため、蓄積した総メニュー数によっては
  // 一覧に出てこない可能性がある。表示のエスケープ確認はPOS画面のメニュー検索結果で行う)。
  const createRes = await page.request.post("/api/menus", { data: { name, price: 100 } });
  expect(createRes.status()).toBe(201);
  const menuNo = ((await createRes.json()) as { menuNo: string }).menuNo;

  await page.goto("/pos");
  await page.getByRole("button", { name: "お客様ID読み込み(会員なし)" }).click();
  await page.getByPlaceholder("メニュー番号(4桁)").fill(menuNo);
  await page.getByRole("button", { name: "読み込み" }).click();

  const menuSection = page.locator("section", { hasText: "メニュー登録" }).first();
  // 文字列としてエスケープ表示され、実際のscript要素として実行されていない
  await expect(menuSection).toContainText(name);
  expect(await page.locator("script", { hasText: "alert(1)" }).count()).toBe(0);
  expect(dialogFired).toBe(false);
});

test("FT-073 会員登録の氏名欄へのスクリプトタグ入力(XSS試行)", async ({ page }) => {
  let dialogFired = false;
  page.on("dialog", () => {
    dialogFired = true;
  });

  await loginAsAdmin(page);
  await page.goto("/admin/members");
  const name = `<img src=x onerror=alert(1)>${Date.now()}`;
  const form = page.locator("form").first();
  await form.locator("input").nth(0).fill(name);
  await form.locator("input").nth(1).fill("090-1234-5678");
  await form.locator("input").nth(2).fill("東京都テスト区1-2-3");
  await form.locator("select").selectOption("NO_ANSWER");
  await form.locator("input").nth(3).fill("30");
  const createResponse = page.waitForResponse(
    (res) => res.url().includes("/api/members") && res.request().method() === "POST"
  );
  await form.getByRole("button", { name: "登録", exact: true }).click();
  const res = await createResponse;
  expect(res.status()).toBe(201);
  const memberId = ((await res.json()) as { memberId: string }).memberId;

  await page.reload();
  const row = page.locator(`table tbody tr:has(td:text-is("${memberId}"))`);
  await expect(row).toBeVisible();
  await expect(row).toContainText(name);
  expect(await page.locator("table img").count()).toBe(0);
  expect(dialogFired).toBe(false);
});

test("FT-074 選択したメニューの選択を解除する", async ({ page }) => {
  await loginAsAdmin(page);
  const name = `FT074メニュー${Date.now()}`;
  await page.goto("/admin/menus");
  const form = page.locator("form").first();
  await form.locator("input").nth(0).fill(name);
  await form.locator("input").nth(1).fill("100");
  const createResponse = page.waitForResponse(
    (res) => res.url().includes("/api/menus") && res.request().method() === "POST"
  );
  await form.getByRole("button", { name: "登録", exact: true }).click();
  const res = await createResponse;
  const menuNo = ((await res.json()) as { menuNo: string }).menuNo;

  await page.goto("/pos");
  await page.getByRole("button", { name: "お客様ID読み込み(会員なし)" }).click();
  await page.getByPlaceholder("メニュー番号(4桁)").fill(menuNo);
  await page.getByRole("button", { name: "読み込み" }).click();
  await page.getByRole("button", { name: "購入リストへ追加" }).click();

  const row = page.locator("table tbody tr", { hasText: name });
  await row.click(); // 選択
  await expect(row).toHaveClass(/bg-blue-100/);
  await expect(page.getByText(`選択中: ${name}`)).toBeVisible();

  await row.click(); // 再度クリックして選択解除
  await expect(row).not.toHaveClass(/bg-blue-100/);
  await expect(page.getByText(`選択中: ${name}`)).toHaveCount(0);
});
