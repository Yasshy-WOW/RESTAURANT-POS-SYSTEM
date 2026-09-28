import { test, expect, Page } from "@playwright/test";

import { requireEnv } from "./helpers";

// テスト仕様書 3.6 マスタメンテナンス(担当者関連: FT-051〜055, 078)

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

async function createStaffViaApi(
  page: Page,
  password: string,
  role: "GENERAL" | "ADMIN" = "GENERAL"
): Promise<string> {
  const res = await page.request.post("/api/staff", { data: { password, role } });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { staffId: string };
  return body.staffId;
}

/**
 * FT-053/FT-054の前提「管理者は0001の1人だけ」は、過去のテスト実行(例: FT-078が昇格させた
 * 担当者)が additive-only 方針で残り続けるDB上では保証されない。事前に0001以外の
 * アクティブな管理者を一般担当者へ降格し、前提を保証してから検証する。
 */
async function ensureSoleAdmin(page: Page) {
  const res = await page.request.get("/api/staff?includeDeleted=false&limit=100");
  const body = (await res.json()) as { staff: { staffId: string; role: string }[] };
  for (const s of body.staff) {
    if (s.role === "ADMIN" && s.staffId !== ADMIN_STAFF_ID) {
      await page.request.put(`/api/staff/${s.staffId}`, { data: { role: "GENERAL" } });
    }
  }
}

test("FT-051 一般担当者がマスタメンテナンス画面にアクセスできない", async ({ page }) => {
  await loginAsAdmin(page);
  const password = "general-pass-1";
  const staffId = await createStaffViaApi(page, password, "GENERAL");

  await page.getByRole("button", { name: "ログアウト" }).click();
  await login(page, staffId, password);
  await expect(page).toHaveURL(/\/pos$/);

  await page.goto("/admin/staff");
  await expect(page.getByText("この画面にアクセスする権限がありません。")).toBeVisible();
});

test("FT-052/FT-055 担当者を削除すると確認ダイアログが出て論理削除される", async ({ page }) => {
  await loginAsAdmin(page);
  const password = "general-pass-2";
  const staffId = await createStaffViaApi(page, password, "GENERAL");

  await page.goto("/admin/staff");
  const row = page.locator(`table tbody tr:has(td:text-is("${staffId}"))`);
  await expect(row).toBeVisible();

  // FT-055: 削除操作時に確認ダイアログが出る
  await row.getByRole("button", { name: "削除" }).click();
  await expect(page.getByText(`担当者「${staffId}」を削除します。本当に削除しますか？`)).toBeVisible();
  await page.getByRole("button", { name: "はい" }).click();

  // FT-052: 論理削除され、既定の一覧には表示されなくなる
  await expect(page.locator(`table tbody tr:has(td:text-is("${staffId}"))`)).toHaveCount(0);
});

test("FT-053 最後の1人の管理者を削除しようとするとエラーになる", async ({ page }) => {
  await loginAsAdmin(page);
  await ensureSoleAdmin(page);
  await page.goto("/admin/staff");
  const row = page.locator(`table tbody tr:has(td:text-is("${ADMIN_STAFF_ID}"))`);
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "削除" }).click();
  await page.getByRole("button", { name: "はい" }).click();

  // 削除できず、エラーメッセージが表示され、一覧にも残ったまま
  await expect(page.getByText("最後の1人の管理者は削除・一般担当者への降格ができません。")).toBeVisible();
  await expect(row).toBeVisible();
});

test("FT-054 最後の1人の管理者を一般担当者に降格しようとするとエラーになる", async ({ page }) => {
  await loginAsAdmin(page);
  await ensureSoleAdmin(page);
  await page.goto("/admin/staff");
  const row = page.locator(`table tbody tr:has(td:text-is("${ADMIN_STAFF_ID}"))`);
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "編集" }).click();
  await row.locator("select").selectOption("GENERAL");
  await row.getByRole("button", { name: "保存" }).click();

  await expect(page.getByText("最後の1人の管理者は削除・一般担当者への降格ができません。")).toBeVisible();
  // 権限区分は管理者のまま変わっていない
  await page.reload();
  await expect(page.locator(`table tbody tr:has(td:text-is("${ADMIN_STAFF_ID}"))`)).toContainText("管理者");
});

test("FT-078 一般担当者を管理者に昇格する", async ({ page }) => {
  await loginAsAdmin(page);
  const password = "general-pass-3";
  const staffId = await createStaffViaApi(page, password, "GENERAL");

  await page.goto("/admin/staff");
  const row = page.locator(`table tbody tr:has(td:text-is("${staffId}"))`);
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "編集" }).click();
  await row.locator("select").selectOption("ADMIN");
  await row.getByRole("button", { name: "保存" }).click();
  await expect(row).toContainText("管理者");

  // 昇格後、マスタメンテナンス画面にアクセスできるようになる
  await page.getByRole("button", { name: "ログアウト" }).click();
  await login(page, staffId, password);
  await expect(page).toHaveURL(/\/pos$/);
  await page.goto("/admin/staff");
  await expect(page.getByText("この画面にアクセスする権限がありません。")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "担当者管理" })).toBeVisible();

  // 後続のFT-053/054(「管理者は0001のみ」が前提)を汚染しないよう、
  // このテスト専用に昇格させた担当者を一般担当者に戻しておく
  // (現在staffId自身が管理者としてログイン中なので、そのセッションのまま自身を降格できる)
  await page.request.put(`/api/staff/${staffId}`, { data: { role: "GENERAL" } });
});
