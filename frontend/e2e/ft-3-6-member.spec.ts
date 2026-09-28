import { test, expect, Page } from "@playwright/test";

// テスト仕様書 3.6 マスタメンテナンス(会員関連: FT-077, 080〜083)

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
  await page.goto("/admin/members");
  await expect(page).toHaveURL(/\/admin\/members$/);
}

async function createMemberViaApi(page: Page, name: string): Promise<string> {
  const res = await page.request.post("/api/members", {
    data: {
      name,
      phone: "090-1234-5678",
      address: "東京都テスト区1-2-3",
      gender: "NO_ANSWER",
      age: 30,
    },
  });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { memberId: string };
  return body.memberId;
}

test("FT-077 管理者が会員情報を編集する", async ({ page }) => {
  await loginAsAdmin(page);
  const name = `FT077会員${Date.now()}`;
  const memberId = await createMemberViaApi(page, name);
  await page.reload();

  const row = page.locator(`table tbody tr:has(td:text-is("${memberId}"))`);
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "編集" }).click();
  await row.locator("input").nth(1).fill("080-9999-8888"); // 氏名の次=電話番号
  await row.getByRole("button", { name: "保存" }).click();

  await expect(row.locator("td").nth(2)).toHaveText("080-9999-8888");
});

test("FT-080/FT-081/FT-082/FT-083 削除済み会員の非表示・表示トグル・復元", async ({ page }) => {
  await loginAsAdmin(page);
  const name = `FT080会員${Date.now()}`;
  const memberId = await createMemberViaApi(page, name);
  await page.reload();

  const row = page.locator(`table tbody tr:has(td:text-is("${memberId}"))`);
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "削除" }).click();
  await page.getByRole("button", { name: "はい" }).click();

  // FT-080: 既定(削除済みを表示オフ)では一覧に表示されない
  await expect(page.locator(`table tbody tr:has(td:text-is("${memberId}"))`)).toHaveCount(0);

  // FT-081: 「削除済みを表示」トグルをオンにすると表示され、復元ボタンが出る
  await page.getByRole("checkbox", { name: "削除済みを表示" }).check();
  const deletedRow = page.locator(`table tbody tr:has(td:text-is("${memberId}"))`);
  await expect(deletedRow).toBeVisible();
  await expect(deletedRow).toContainText("削除済み");
  const restoreButton = deletedRow.getByRole("button", { name: "復元" });
  await expect(restoreButton).toBeVisible();

  // FT-083: 復元操作には確認ダイアログが出ない(即座に実行される)
  await restoreButton.click();
  await expect(page.getByText(/本当に/)).toHaveCount(0);

  // FT-082: 復元によりis_active=trueに戻り、通常利用できる状態になる
  await expect(deletedRow).toContainText("有効");
  await page.getByRole("checkbox", { name: "削除済みを表示" }).uncheck();
  await expect(page.locator(`table tbody tr:has(td:text-is("${memberId}"))`)).toBeVisible();

  // POSのお客様ID読み込みでも通常通り使えることを確認
  await page.goto("/pos");
  await page.getByPlaceholder("会員ID(8桁)").fill(memberId);
  await page.getByRole("button", { name: "会員ID読み込み" }).click();
  await expect(page.getByText(`会員ID: ${memberId}`)).toBeVisible();
});
