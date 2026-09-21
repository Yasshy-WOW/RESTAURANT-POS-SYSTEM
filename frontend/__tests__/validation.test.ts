import { memberIdSchema, menuFormSchema, taxRateFormSchema } from "@/lib/validation";

test("FE-011: 会員IDは8桁以外の数字を入力するとバリデーションエラーになる(境界値: 7桁・9桁)", () => {
  expect(memberIdSchema.safeParse("1234567").success).toBe(false); // 7桁
  expect(memberIdSchema.safeParse("123456789").success).toBe(false); // 9桁
  expect(memberIdSchema.safeParse("12345678").success).toBe(true); // 8桁: 正常
});

test("FE-015: 消費税率は0〜100の範囲外(-1や101)を入力するとバリデーションエラーになる", () => {
  expect(taxRateFormSchema.safeParse({ ratePercent: -1 }).success).toBe(false);
  expect(taxRateFormSchema.safeParse({ ratePercent: 101 }).success).toBe(false);
  expect(taxRateFormSchema.safeParse({ ratePercent: 0 }).success).toBe(true);
  expect(taxRateFormSchema.safeParse({ ratePercent: 100 }).success).toBe(true);
});

test("FE-016: メニュー単価は0以下または小数を入力するとバリデーションエラーになる", () => {
  expect(menuFormSchema.safeParse({ name: "A", price: 0 }).success).toBe(false);
  expect(menuFormSchema.safeParse({ name: "A", price: -100 }).success).toBe(false);
  expect(menuFormSchema.safeParse({ name: "A", price: 100.5 }).success).toBe(false);
  expect(menuFormSchema.safeParse({ name: "A", price: 1 }).success).toBe(true);
});

test("FE-017: メニュー名は51文字以上を入力するとバリデーションエラーになる(境界値: 文字数上限)", () => {
  expect(menuFormSchema.safeParse({ name: "あ".repeat(50), price: 100 }).success).toBe(true);
  expect(menuFormSchema.safeParse({ name: "あ".repeat(51), price: 100 }).success).toBe(false);
});
