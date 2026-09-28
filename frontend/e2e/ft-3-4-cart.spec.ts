import { test, expect, Page } from "@playwright/test";

// テスト仕様書 3.4 購入リスト操作(FT-030〜FT-035)

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

async function loginAsAdmin(page: Page) {
  await login(page, ADMIN_STAFF_ID, ADMIN_PASSWORD);
  await expect(page).toHaveURL(/\/pos$/);
}

async function createMenu(page: Page, name: string, price: number): Promise<string> {
  await page.goto("/admin/menus");
  await expect(page).toHaveURL(/\/admin\/menus$/);
  const form = page.locator("form").first();
  await form.locator("input").nth(0).fill(name);
  await form.locator("input").nth(1).fill(String(price));
  await form.getByRole("button", { name: "登録", exact: true }).click();

  const row = page.locator("table tbody tr", { hasText: name });
  await expect(row).toBeVisible();
  const menuNo = await row.locator("td").first().innerText();
  expect(menuNo).toMatch(/^\d{4}$/);
  return menuNo;
}

async function goToPosAndSkipMember(page: Page) {
  await page.goto("/pos");
  await page.getByRole("button", { name: "お客様ID読み込み(会員なし)" }).click();
}

async function lookupMenu(page: Page, menuNo: string) {
  await page.getByPlaceholder("メニュー番号(4桁)").fill(menuNo);
  const response = page.waitForResponse((res) => res.url().includes(`/api/menus/${menuNo}`));
  await page.getByRole("button", { name: "読み込み" }).click();
  await response;
}

async function addMenuToCart(page: Page, menuNo: string) {
  await lookupMenu(page, menuNo);
  await page.getByRole("button", { name: "購入リストへ追加" }).click();
}

test("FT-030/FT-031 購入リストのメニューを選択・削除する", async ({ page }) => {
  await loginAsAdmin(page);
  const name1 = `FT030メニューA${Date.now()}`;
  const menuNo1 = await createMenu(page, name1, 100);
  const name2 = `FT030メニューB${Date.now()}`;
  const menuNo2 = await createMenu(page, name2, 200);

  await goToPosAndSkipMember(page);
  await addMenuToCart(page, menuNo1);
  await addMenuToCart(page, menuNo2);
  await expect(page.locator("table tbody tr")).toHaveCount(2);

  // FT-030: 1件を選択すると強調表示され、詳細(選択中の名称)が表示される
  const row1 = page.locator("table tbody tr", { hasText: name1 });
  await row1.click();
  await expect(row1).toHaveClass(/bg-blue-100/);
  await expect(page.getByText(`選択中: ${name1}`)).toBeVisible();

  // FT-031: 選択したメニューを削除すると購入リストから消える
  await page.getByRole("button", { name: "削除" }).click();
  await expect(page.locator("table tbody tr", { hasText: name1 })).toHaveCount(0);
  await expect(page.locator("table tbody tr")).toHaveCount(1);
});

test("FT-032 数量を1から5に変更する", async ({ page }) => {
  await loginAsAdmin(page);
  const name = `FT032メニュー${Date.now()}`;
  const menuNo = await createMenu(page, name, 100);

  await goToPosAndSkipMember(page);
  await addMenuToCart(page, menuNo);
  const row = page.locator("table tbody tr", { hasText: name });
  await row.click();
  await page.locator('input[inputmode="numeric"]').last().fill("5");
  await page.getByRole("button", { name: "数量変更" }).click();

  await expect(row.locator("td").nth(1)).toHaveText("5");
  await expect(row.locator("td").nth(3)).toHaveText("500円"); // 小計再計算
  await expect(page.getByText("合計(税込): 500円")).toBeVisible();
});

test("FT-033 数量を1から0にしようとするとエラーになる", async ({ page }) => {
  await loginAsAdmin(page);
  const name = `FT033メニュー${Date.now()}`;
  const menuNo = await createMenu(page, name, 100);

  await goToPosAndSkipMember(page);
  await addMenuToCart(page, menuNo);
  const row = page.locator("table tbody tr", { hasText: name });
  await row.click();
  await page.locator('input[inputmode="numeric"]').last().fill("0");
  await page.getByRole("button", { name: "数量変更" }).click();

  await expect(row.locator("td").nth(1)).toHaveText("1"); // 変更されない
  await expect(page.getByText(/削除操作を行ってください/)).toBeVisible();
});

test("FT-034/FT-035 数量上限99個の境界(99から100にはできない、98から99は成功)", async ({ page }) => {
  await loginAsAdmin(page);
  const name = `FT034メニュー${Date.now()}`;
  const menuNo = await createMenu(page, name, 100);

  await goToPosAndSkipMember(page);
  await addMenuToCart(page, menuNo);
  const row = page.locator("table tbody tr", { hasText: name });
  await row.click();

  // FT-035: 98への変更 -> 99への変更(成功)
  await page.locator('input[inputmode="numeric"]').last().fill("98");
  await page.getByRole("button", { name: "数量変更" }).click();
  await expect(row.locator("td").nth(1)).toHaveText("98");

  await page.locator('input[inputmode="numeric"]').last().fill("99");
  await page.getByRole("button", { name: "数量変更" }).click();
  await expect(row.locator("td").nth(1)).toHaveText("99");

  // FT-034: 99から100への変更はできず、99が上限としてエラーになる
  await page.locator('input[inputmode="numeric"]').last().fill("100");
  await page.getByRole("button", { name: "数量変更" }).click();
  await expect(row.locator("td").nth(1)).toHaveText("99"); // 変更されない
  await expect(page.getByText(/数量は99個までです/)).toBeVisible();
});
