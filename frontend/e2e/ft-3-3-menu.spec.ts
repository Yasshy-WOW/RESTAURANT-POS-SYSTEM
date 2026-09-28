import { test, expect, Page } from "@playwright/test";

// テスト仕様書 3.3 メニュー登録(手入力・バーコード)(FT-020〜FT-027)
// カメラを使うFT-022・FT-023・FT-027はヘッドレスブラウザで実カメラを再現できないため、本ファイルでは対象外
// (別途、擬似カメラ映像を用いた検証方針を協議する)。

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

test("FT-020 存在するメニュー番号を手入力", async ({ page }) => {
  await loginAsAdmin(page);
  const name = `FT020メニュー${Date.now()}`;
  const menuNo = await createMenu(page, name, 300);

  await goToPosAndSkipMember(page);
  await lookupMenu(page, menuNo);

  await expect(page.getByText(name)).toBeVisible();
  await expect(page.getByText("300円(税込)")).toBeVisible();
});

test("FT-021 存在しないメニュー番号を手入力", async ({ page }) => {
  await loginAsAdmin(page);
  await goToPosAndSkipMember(page);
  await lookupMenu(page, "0999");

  await expect(page.getByText("メニュー登録").locator("..").locator("p.text-red-600")).toBeVisible();
});

test("FT-024 同じメニューを続けて登録すると数量が+1される", async ({ page }) => {
  await loginAsAdmin(page);
  const name = `FT024メニュー${Date.now()}`;
  const menuNo = await createMenu(page, name, 250);

  await goToPosAndSkipMember(page);
  await lookupMenu(page, menuNo);
  await page.getByRole("button", { name: "購入リストへ追加" }).click();

  const row = page.locator("table tbody tr", { hasText: name });
  await expect(row).toBeVisible();
  await expect(row.locator("td").nth(1)).toHaveText("1");

  await lookupMenu(page, menuNo);
  await page.getByRole("button", { name: "購入リストへ追加" }).click();

  // 新しい行は増えず、既存行の数量が+1される
  await expect(page.locator("table tbody tr", { hasText: name })).toHaveCount(1);
  await expect(row.locator("td").nth(1)).toHaveText("2");
});

test("FT-025/FT-026 数量上限99個の境界(98→99は成功、99→追加はエラー)", async ({ page }) => {
  await loginAsAdmin(page);
  const name = `FT025メニュー${Date.now()}`;
  const menuNo = await createMenu(page, name, 150);

  await goToPosAndSkipMember(page);
  await lookupMenu(page, menuNo);
  await page.getByRole("button", { name: "購入リストへ追加" }).click();

  const row = page.locator("table tbody tr", { hasText: name });
  await row.click(); // 選択
  await page.locator('input[inputmode="numeric"]').last().fill("98");
  await page.getByRole("button", { name: "数量変更" }).click();
  await expect(row.locator("td").nth(1)).toHaveText("98");

  // FT-026: 98 -> 99 (成功)
  await lookupMenu(page, menuNo);
  await page.getByRole("button", { name: "購入リストへ追加" }).click();
  await expect(row.locator("td").nth(1)).toHaveText("99");

  // FT-025: 99からさらに追加しようとするとエラーになり、数量は加算されない
  await lookupMenu(page, menuNo);
  await page.getByRole("button", { name: "購入リストへ追加" }).click();
  await expect(row.locator("td").nth(1)).toHaveText("99");
  await expect(page.getByText(/数量の上限.*に達しています/)).toBeVisible();
});
