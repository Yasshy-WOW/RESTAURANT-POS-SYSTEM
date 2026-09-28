import { test, expect, Page } from "@playwright/test";

import { requireEnv } from "./helpers";

// テスト仕様書 3.5 購入確定・消費税計算(FT-040〜FT-048)

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

async function createMenu(page: Page, name: string, price: number): Promise<string> {
  // 一覧取得APIは既定でlimit=20が適用されるため、これまでのテストで有効なメニューが
  // 20件を超えていると管理画面の一覧に新規行が表示されない(仕様通りの挙動)。
  // 一覧のtoBeVisibleで探すのではなく、作成APIのレスポンスから直接メニュー番号を取得する。
  await page.goto("/admin/menus");
  await expect(page).toHaveURL(/\/admin\/menus$/);
  const form = page.locator("form").first();
  await form.locator("input").nth(0).fill(name);
  await form.locator("input").nth(1).fill(String(price));
  const createResponse = page.waitForResponse(
    (res) => res.url().includes("/api/menus") && res.request().method() === "POST"
  );
  await form.getByRole("button", { name: "登録", exact: true }).click();
  const res = await createResponse;
  const body = (await res.json()) as { menuNo: string };
  expect(body.menuNo).toMatch(/^\d{4}$/);
  return body.menuNo;
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

test("FT-040 購入リストがある状態で購入確定する", async ({ page }) => {
  await loginAsAdmin(page);
  const name = `FT040メニュー${Date.now()}`;
  const menuNo = await createMenu(page, name, 300);

  await goToPosAndSkipMember(page);
  await addMenuToCart(page, menuNo);
  await page.getByRole("button", { name: "購入" }).click();

  await expect(page.getByText("購入確定")).toBeVisible();
  await expect(page.getByText(/税込み合計: 300円/)).toBeVisible();
});

test("FT-041 購入リストが空の状態では購入ボタンが押せない", async ({ page }) => {
  await loginAsAdmin(page);
  await goToPosAndSkipMember(page);
  await expect(page.getByRole("button", { name: "購入" })).toBeDisabled();
});

test("FT-042 確定時点で削除済みのメニューが購入リストに含まれるとエラーになる", async ({ page }) => {
  await loginAsAdmin(page);
  const name = `FT042メニュー${Date.now()}`;
  const menuNo = await createMenu(page, name, 400);

  await goToPosAndSkipMember(page);
  await addMenuToCart(page, menuNo);

  // 管理画面の一覧は既定limit=20のため、蓄積したテストデータの後ろに埋もれた
  // このメニューをUI上で見つけて削除ボタンを押すのは信頼できない。
  // 削除ボタンが呼ぶのと同じ削除APIを直接呼ぶことで、
  // 「管理者がこのメニューを削除した」という状態を作る(カートのstateは維持したまま)。
  const deleteRes = await page.request.delete(`/api/menus/${menuNo}`);
  expect(deleteRes.status()).toBe(204);

  await page.getByRole("button", { name: "購入" }).click();
  await expect(page.getByText("購入リストに削除済みのメニューが含まれているため、購入を確定できません。")).toBeVisible();
  // 確定できておらず、購入確定ポップアップは出ない
  await expect(page.getByText("購入確定")).toHaveCount(0);
});

test("FT-043/FT-075 消費税額の計算(行ごと四捨五入)", async ({ page }) => {
  await loginAsAdmin(page);
  const name = `FT043メニュー${Date.now()}`;
  const menuNo = await createMenu(page, name, 111); // 税込111円・税率10%

  await goToPosAndSkipMember(page);
  await addMenuToCart(page, menuNo);
  await page.getByRole("button", { name: "購入" }).click();

  // 111 / 1.1 = 100.90... -> 四捨五入で101円(税抜)、税込は111円のまま
  await expect(page.getByText(/税込み合計: 111円/)).toBeVisible();
  await expect(page.getByText(/税抜き合計: 101円/)).toBeVisible();
});

test("FT-044 ポップアップを閉じると画面がクリアされる", async ({ page }) => {
  await loginAsAdmin(page);
  const name = `FT044メニュー${Date.now()}`;
  const menuNo = await createMenu(page, name, 100);

  await goToPosAndSkipMember(page);
  await addMenuToCart(page, menuNo);
  await page.getByRole("button", { name: "購入" }).click();
  await expect(page.getByText("購入確定")).toBeVisible();
  await page.getByRole("button", { name: "閉じる" }).click();

  // 購入リスト・会員ID表示がクリアされ、最初の状態(会員ID読み込み前)に戻る
  await expect(page.getByText("購入リストは空です")).toBeVisible();
  await expect(page.getByRole("button", { name: "お客様ID読み込み(会員なし)" })).toBeVisible();
});

test("FT-045/FT-046 メニュー単価・消費税率の変更が過去の取引に影響しない", async ({ page }) => {
  await loginAsAdmin(page);
  const name = `FT045メニュー${Date.now()}`;
  const menuNo = await createMenu(page, name, 200);

  await goToPosAndSkipMember(page);
  await addMenuToCart(page, menuNo);

  const createResponse = page.waitForResponse(
    (res) => res.url().includes("/api/transactions") && res.request().method() === "POST"
  );
  await page.getByRole("button", { name: "購入" }).click();
  const res = await createResponse;
  const body = (await res.json()) as { transactionId: string };
  const transactionId = body.transactionId;
  expect(transactionId).toBeTruthy();
  await page.getByRole("button", { name: "閉じる" }).click();

  // メニュー単価を200円->500円に変更。
  // 管理画面の一覧は既定limit=20で、蓄積したテストデータの後ろに埋もれて表示されないため
  // (編集UI自体の検証はFT-076が担当)、ここでは編集ボタンが呼ぶのと同じ更新APIを直接呼ぶ。
  const putRes = await page.request.put(`/api/menus/${menuNo}`, { data: { name, price: 500 } });
  expect(putRes.status()).toBe(204);

  // 消費税率を10%->8%に変更(後で10%に戻す)
  await page.goto("/admin/tax-rate");
  await page.locator('input[inputmode="numeric"]').fill("8");
  await page.getByRole("button", { name: "変更" }).click();
  await expect(page.getByText("現在の消費税率: 8%")).toBeVisible();

  // 過去の取引記録(API)を確認: 単価・税率のスナップショットは変更前のまま保持されている
  const txRes = await page.request.get(`/api/transactions/${transactionId}`);
  expect(txRes.ok()).toBeTruthy();
  const tx = await txRes.json();
  expect(tx.taxRatePercentSnapshot).toBe(10);
  expect(tx.details[0].unitPriceSnapshot).toBe(200);
  expect(tx.totalAmountWithTax).toBe(200);

  // 後続テストに影響しないよう税率を10%に戻す
  await page.goto("/admin/tax-rate");
  await page.locator('input[inputmode="numeric"]').fill("10");
  await page.getByRole("button", { name: "変更" }).click();
  await expect(page.getByText("現在の消費税率: 10%")).toBeVisible();
});

test("FT-047/FT-048 購入確定時のバックエンド保存失敗とその後の再試行成功", async ({ page }) => {
  await loginAsAdmin(page);
  const name = `FT047メニュー${Date.now()}`;
  const menuNo = await createMenu(page, name, 250);

  await goToPosAndSkipMember(page);
  await addMenuToCart(page, menuNo);

  // FT-047: 1回目の購入リクエストだけ強制的に500エラーにする(サーバー障害を模擬)
  let intercepted = false;
  await page.route("**/api/transactions", async (route) => {
    if (route.request().method() === "POST" && !intercepted) {
      intercepted = true;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error_code: "INTERNAL_ERROR", message: "サーバー内部でエラーが発生しました。" }),
      });
      return;
    }
    await route.continue();
  });

  await page.getByRole("button", { name: "購入" }).click();
  await expect(page.getByText("サーバー内部でエラーが発生しました。")).toBeVisible();
  // 購入リストの内容は保持されたまま(決定事項No.29)
  await expect(page.locator("table tbody tr", { hasText: name })).toHaveCount(1);
  await expect(page.getByText("購入確定")).toHaveCount(0);

  // FT-048: 再度購入ボタンを押すと、保持されていた内容で正常に確定する(2回目はroute.continueで実サーバーに到達)
  await page.getByRole("button", { name: "購入" }).click();
  await expect(page.getByText("購入確定")).toBeVisible();
  await expect(page.getByText(/税込み合計: 250円/)).toBeVisible();

  await page.unroute("**/api/transactions");
});
