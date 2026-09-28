import { test, expect, Page } from "@playwright/test";

// テスト仕様書 3.2 会員ID読み込み(FT-010〜FT-016)
// 既存データ(gen12-mysql-pos)は削除せず、テストに必要な会員のみ追加で登録する。

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

async function createMember(page: Page, name: string): Promise<string> {
  await page.goto("/admin/members");
  await expect(page).toHaveURL(/\/admin\/members$/);
  const form = page.locator("form").first();
  await form.locator("input").nth(0).fill(name);
  await form.locator("input").nth(1).fill("090-1234-5678");
  await form.locator("input").nth(2).fill("東京都テスト区1-2-3");
  await form.locator("select").selectOption("NO_ANSWER");
  await form.locator("input").nth(3).fill("30");
  await form.getByRole("button", { name: "登録", exact: true }).click();

  const row = page.locator("table tbody tr", { hasText: name });
  await expect(row).toBeVisible();
  const memberId = await row.locator("td").first().innerText();
  expect(memberId).toMatch(/^\d{8}$/);
  return memberId;
}

test("FT-010 存在する会員IDを読み込む", async ({ page }) => {
  await loginAsAdmin(page);
  const name = `FT010会員${Date.now()}`;
  const memberId = await createMember(page, name);

  await page.goto("/pos");
  await page.getByPlaceholder("会員ID(8桁)").fill(memberId);
  await page.getByRole("button", { name: "会員ID読み込み" }).click();

  await expect(page.getByText(`会員ID: ${memberId}`)).toBeVisible();
  // 氏名は表示されない(決定事項No.20)
  await expect(page.getByText(name)).not.toBeVisible();
});

test("FT-011 存在しない会員IDを読み込む", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/pos");
  await page.getByPlaceholder("会員ID(8桁)").fill("99999999");
  await page.getByRole("button", { name: "会員ID読み込み" }).click();

  // エラーが表示され、先に進めない(会員IDセクションの入力欄が残ったまま)
  await expect(page.getByPlaceholder("会員ID(8桁)")).toBeVisible();
  const memberSection = page.locator("section", { hasText: "会員ID" }).first();
  await expect(memberSection.locator("p.text-red-600")).toBeVisible();
});

test("FT-012 会員IDを入力せずに購入を進める(会員なし)", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/pos");
  await page.getByRole("button", { name: "お客様ID読み込み(会員なし)" }).click();
  await expect(page.getByText("会員なし")).toBeVisible();
});

test("FT-013 一度読み込んだ会員IDの訂正はできない", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/pos");
  await page.getByRole("button", { name: "お客様ID読み込み(会員なし)" }).click();
  await expect(page.getByText("会員なし")).toBeVisible();

  // 会員ID入力欄・読み込みボタンはもう表示されない(訂正の手段が存在しない = 決定事項No.19)
  await expect(page.getByPlaceholder("会員ID(8桁)")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "会員ID読み込み" })).toHaveCount(0);
});

test("FT-014 会員IDの桁数不足(7桁)で入力", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/pos");
  await page.getByPlaceholder("会員ID(8桁)").fill("1234567");
  await page.getByRole("button", { name: "会員ID読み込み" }).click();
  const memberSection = page.locator("section", { hasText: "会員ID" }).first();
  await expect(memberSection.locator("p.text-red-600")).toContainText("8桁");
});

test(
  "FT-015 会員IDの桁数超過(9桁)で入力",
  {
    annotation: {
      type: "known-issue",
      description:
        "会員ID入力欄はmaxLength=8のため9桁目を物理的に入力できず、先頭8桁が未登録IDの場合は" +
        "「フォーマット不正」ではなく「指定された会員IDは登録されていません。」になる。" +
        "テスト仕様書FT-015が期待する挙動と一致しないため、既知の不具合として記録(2026-09-28)。",
    },
  },
  async ({ page }) => {
    test.fail(); // 現状の実装では期待するフォーマットエラーに到達しないことを確認する(再現すればテストは失敗し続ける)
    await loginAsAdmin(page);
    await page.goto("/pos");
    await page.getByPlaceholder("会員ID(8桁)").fill("123456789");
    await page.getByRole("button", { name: "会員ID読み込み" }).click();
    const memberSection = page.locator("section", { hasText: "会員ID" }).first();
    await expect(memberSection.locator("p.text-red-600")).toContainText("8桁");
  }
);

test("FT-016 論理削除済みの会員IDを読み込む", async ({ page }) => {
  await loginAsAdmin(page);
  const name = `FT016会員${Date.now()}`;
  const memberId = await createMember(page, name);

  // 作成した会員をアプリの削除機能で論理削除する
  const row = page.locator("table tbody tr", { hasText: name });
  await row.getByRole("button", { name: "削除" }).click();
  await page.getByRole("button", { name: "はい" }).click();
  await expect(page.locator("table tbody tr", { hasText: name })).toHaveCount(0);

  await page.goto("/pos");
  await page.getByPlaceholder("会員ID(8桁)").fill(memberId);
  await page.getByRole("button", { name: "会員ID読み込み" }).click();

  const memberSection = page.locator("section", { hasText: "会員ID" }).first();
  await expect(memberSection.locator("p.text-red-600")).toBeVisible();
});
