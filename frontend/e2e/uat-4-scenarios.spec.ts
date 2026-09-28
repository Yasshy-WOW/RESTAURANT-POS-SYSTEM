import { test, expect, Page } from "@playwright/test";

// テスト仕様書 4章 ユーザーテスト仕様(UAT-001〜011)
// 個々の機能はFT/BE/FEで検証済みのため、ここでは業務シナリオとして一連の流れが
// 違和感なく完結するか(エラー時に迷わないか、等)を確認する。

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

async function createMenuViaApi(page: Page, name: string, price: number): Promise<string> {
  const res = await page.request.post("/api/menus", { data: { name, price } });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { menuNo: string }).menuNo;
}

async function createMemberViaApi(page: Page, name: string): Promise<string> {
  const res = await page.request.post("/api/members", {
    data: { name, phone: "090-1234-5678", address: "東京都テスト区1-2-3", gender: "NO_ANSWER", age: 30 },
  });
  expect(res.status()).toBe(201);
  return ((await res.json()) as { memberId: string }).memberId;
}

test("UAT-001 レジ担当者が出勤し、ログインしてレジ業務を開始する", async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page.getByRole("heading", { name: "会員ID" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "メニュー登録" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "購入リスト" })).toBeVisible();
});

test("UAT-002 会員のお客様が複数のメニューを注文し、会計する", async ({ page }) => {
  await loginAsAdmin(page);
  const name1 = `UAT002メニューA${Date.now()}`;
  const menuNo1 = await createMenuViaApi(page, name1, 300);
  const name2 = `UAT002メニューB${Date.now()}`;
  const menuNo2 = await createMenuViaApi(page, name2, 500);
  const memberId = await createMemberViaApi(page, `UAT002会員${Date.now()}`);

  await page.goto("/pos");
  await page.getByPlaceholder("会員ID(8桁)").fill(memberId);
  await page.getByRole("button", { name: "会員ID読み込み" }).click();
  await expect(page.getByText(`会員ID: ${memberId}`)).toBeVisible();

  for (const menuNo of [menuNo1, menuNo2]) {
    await page.getByPlaceholder("メニュー番号(4桁)").fill(menuNo);
    await page.getByRole("button", { name: "読み込み" }).click();
    await page.getByRole("button", { name: "購入リストへ追加" }).click();
  }
  await expect(page.locator("table tbody tr")).toHaveCount(2);

  await page.getByRole("button", { name: "購入" }).click();
  await expect(page.getByText("購入確定")).toBeVisible();
  await expect(page.getByText(/税込み合計: 800円/)).toBeVisible();
  await page.getByRole("button", { name: "閉じる" }).click();
  await expect(page.getByText("購入リストは空です")).toBeVisible();
});

test("UAT-003 会員証を持たないお客様が、注文・会計する", async ({ page }) => {
  await loginAsAdmin(page);
  const name = `UAT003メニュー${Date.now()}`;
  const menuNo = await createMenuViaApi(page, name, 250);

  await page.goto("/pos");
  await page.getByRole("button", { name: "お客様ID読み込み(会員なし)" }).click();
  await expect(page.getByText("会員なし")).toBeVisible();

  await page.getByPlaceholder("メニュー番号(4桁)").fill(menuNo);
  await page.getByRole("button", { name: "読み込み" }).click();
  await page.getByRole("button", { name: "購入リストへ追加" }).click();
  await page.getByRole("button", { name: "購入" }).click();
  await expect(page.getByText("購入確定")).toBeVisible();
});

test("UAT-004 存在しない会員証(読み取り不良や他店カード)を提示する", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/pos");
  await page.getByPlaceholder("会員ID(8桁)").fill("99999998");
  await page.getByRole("button", { name: "会員ID読み込み" }).click();

  // エラーが分かりやすく表示され(会員IDセクション内)、レジ担当者は
  // 「お客様ID読み込み(会員なし)」で会員なし扱いに切り替えて次に進める
  const memberSection = page.locator("section", { hasText: "会員ID" }).first();
  await expect(memberSection.locator("p.text-red-600")).toBeVisible();
  await page.getByRole("button", { name: "お客様ID読み込み(会員なし)" }).click();
  await expect(page.getByText("会員なし")).toBeVisible();
});

test("UAT-005 レジ担当者が誤ったメニュー番号を入力してしまう", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/pos");
  await page.getByRole("button", { name: "お客様ID読み込み(会員なし)" }).click();
  await page.getByPlaceholder("メニュー番号(4桁)").fill("0000");
  await page.getByRole("button", { name: "読み込み" }).click();

  const menuSection = page.locator("section", { hasText: "メニュー登録" }).first();
  await expect(menuSection.locator("p.text-red-600")).toBeVisible();
  // 購入リストへは何も追加されておらず、担当者はすぐ入力ミスに気付ける
  await expect(page.getByText("購入リストは空です")).toBeVisible();
});

test("UAT-006/UAT-007 同じメニューを99個ちょうど注文でき、100個目はエラーになる", async ({ page }) => {
  await loginAsAdmin(page);
  const name = `UAT006メニュー${Date.now()}`;
  const menuNo = await createMenuViaApi(page, name, 100);

  await page.goto("/pos");
  await page.getByRole("button", { name: "お客様ID読み込み(会員なし)" }).click();
  await page.getByPlaceholder("メニュー番号(4桁)").fill(menuNo);
  await page.getByRole("button", { name: "読み込み" }).click();
  await page.getByRole("button", { name: "購入リストへ追加" }).click();

  const row = page.locator("table tbody tr", { hasText: name });
  await row.click();
  await page.locator('input[inputmode="numeric"]').last().fill("99");
  await page.getByRole("button", { name: "数量変更" }).click();
  await expect(row.locator("td").nth(1)).toHaveText("99"); // UAT-006

  await page.getByPlaceholder("メニュー番号(4桁)").fill(menuNo);
  await page.getByRole("button", { name: "読み込み" }).click();
  await page.getByRole("button", { name: "購入リストへ追加" }).click();
  await expect(row.locator("td").nth(1)).toHaveText("99"); // 加算されない
  await expect(page.getByText(/数量の上限.*に達しています/)).toBeVisible(); // UAT-007
});

test("UAT-008 営業終了後、管理者が新メニューを登録し、翌日から販売開始する", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/admin/menus");
  const name = `UAT008メニュー${Date.now()}`;
  const form = page.locator("form").first();
  await form.locator("input").nth(0).fill(name);
  await form.locator("input").nth(1).fill("450");
  const createResponse = page.waitForResponse(
    (res) => res.url().includes("/api/menus") && res.request().method() === "POST"
  );
  await form.getByRole("button", { name: "登録", exact: true }).click();
  const res = await createResponse;
  const menuNo = ((await res.json()) as { menuNo: string }).menuNo;
  expect(menuNo).toMatch(/^\d{4}$/); // 番号は自動で割り振られる

  // 翌日の営業(=新しいログインセッション)を模して、登録した番号で通常通り販売できる
  await page.getByRole("button", { name: "ログアウト" }).click();
  await loginAsAdmin(page);
  await page.goto("/pos");
  await page.getByRole("button", { name: "お客様ID読み込み(会員なし)" }).click();
  await page.getByPlaceholder("メニュー番号(4桁)").fill(menuNo);
  await page.getByRole("button", { name: "読み込み" }).click();
  await expect(page.getByText(name)).toBeVisible();
});

test("UAT-009 一般担当者が誤って管理者専用機能に入ろうとする", async ({ page }) => {
  await loginAsAdmin(page);
  const password = "uat009-pass";
  const createRes = await page.request.post("/api/staff", { data: { password, role: "GENERAL" } });
  const staffId = ((await createRes.json()) as { staffId: string }).staffId;

  await page.getByRole("button", { name: "ログアウト" }).click();
  await login(page, staffId, password);
  await expect(page).toHaveURL(/\/pos$/);

  // ナビゲーションにマスタメンテナンスへの導線が出ない
  await expect(page.getByRole("link", { name: "担当者管理" })).toHaveCount(0);

  // 直接URLを入力しても、権限がない旨が分かりやすく伝わる
  await page.goto("/admin/staff");
  await expect(page.getByText("この画面にアクセスする権限がありません。")).toBeVisible();
});

test("UAT-010 JWT期限切れ時、作業内容は失われるが再ログイン自体はスムーズに行える", async ({ page }) => {
  await loginAsAdmin(page);
  const name = `UAT010メニュー${Date.now()}`;
  const menuNo = await createMenuViaApi(page, name, 100);

  await page.goto("/pos");
  await page.getByRole("button", { name: "お客様ID読み込み(会員なし)" }).click();
  await page.getByPlaceholder("メニュー番号(4桁)").fill(menuNo);
  await page.getByRole("button", { name: "読み込み" }).click();
  await page.getByRole("button", { name: "購入リストへ追加" }).click();
  await expect(page.locator("table tbody tr")).toHaveCount(1);

  // 8時間超の連続稼働を待つ代わりに、次のAPIリクエストがJWT期限切れを返す状況を模擬する
  await page.route("**/api/tax-rate", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error_code: "AUTH_TOKEN_EXPIRED", message: "セッションの有効期限が切れました。" }),
    });
  });
  await page.reload();

  // 作業中の購入リストは失われるが、ログイン画面へスムーズに戻る(決定事項No.28)
  await expect(page).toHaveURL(/\/login$/);
  await page.unroute("**/api/tax-rate");
  await login(page, ADMIN_STAFF_ID, ADMIN_PASSWORD);
  await expect(page).toHaveURL(/\/pos$/);
  await expect(page.getByText("購入リストは空です")).toBeVisible();
});

test("UAT-011 管理者が誤って削除したメニューに気付き、復元する", async ({ page }) => {
  await loginAsAdmin(page);
  const name = `UAT011メニュー${Date.now()}`;
  const menuNo = await createMenuViaApi(page, name, 350);
  const delRes = await page.request.delete(`/api/menus/${menuNo}`);
  expect(delRes.status()).toBe(204);

  // 「削除済みを表示」トグルからの復元操作(UI)自体はFT-080〜083(会員)で検証済み。
  // ここでは管理画面一覧がlimit=100超のため蓄積した総メニュー数によっては一覧に出てこない
  // 可能性があるので、復元ボタンが呼ぶのと同じ更新APIを直接呼ぶ。
  const restoreRes = await page.request.put(`/api/menus/${menuNo}`, { data: { isActive: true } });
  expect(restoreRes.status()).toBe(204);

  // 復元後、通常のメニューとしてすぐに再度販売できる
  await page.goto("/pos");
  await page.getByRole("button", { name: "お客様ID読み込み(会員なし)" }).click();
  await page.getByPlaceholder("メニュー番号(4桁)").fill(menuNo);
  await page.getByRole("button", { name: "読み込み" }).click();
  await expect(page.getByText(name)).toBeVisible();
});
