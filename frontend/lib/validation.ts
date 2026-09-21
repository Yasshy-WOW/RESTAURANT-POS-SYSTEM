import { z } from "zod";

// バックエンド(app/schemas配下)と同じ上下限を、送信前のフロント側検証としても適用する
// (設計仕様書5.6節: フォーム入力値はAPI送信前にもスキーマバリデーションを行う)。

export const staffIdSchema = z.string().regex(/^\d{4}$/, "担当者IDは数字4桁で入力してください。");
export const memberIdSchema = z.string().regex(/^\d{8}$/, "会員IDは数字8桁で入力してください。");
export const menuNoSchema = z.string().regex(/^\d{4}$/, "メニュー番号は数字4桁で入力してください。");

export const passwordSchema = z
  .string()
  .min(1, "パスワードを入力してください。")
  .max(100, "パスワードは100文字以内で入力してください。");

export const loginSchema = z.object({
  staffId: staffIdSchema,
  password: passwordSchema,
});

export const genderSchema = z.enum(["MALE", "FEMALE", "OTHER", "NO_ANSWER"]);

export const memberFormSchema = z.object({
  name: z.string().min(1, "氏名を入力してください。").max(50, "氏名は50文字以内で入力してください。"),
  phone: z
    .string()
    .min(10, "電話番号は10〜13文字で入力してください。")
    .max(13, "電話番号は10〜13文字で入力してください。")
    .regex(/^[0-9-]+$/, "電話番号は数字とハイフンのみ使用できます。"),
  address: z.string().min(1, "住所を入力してください。").max(200, "住所は200文字以内で入力してください。"),
  gender: genderSchema,
  age: z.number().int().min(0, "年齢は0以上で入力してください。").max(120, "年齢は120以下で入力してください。"),
});

export const menuFormSchema = z.object({
  name: z.string().min(1, "メニュー名を入力してください。").max(50, "メニュー名は50文字以内で入力してください。"),
  // 単価は1円以上の正の整数(決定事項No.31)
  price: z.number().int().min(1, "単価は1円以上で入力してください。").max(999_999, "単価が上限を超えています。"),
});

export const staffFormSchema = z.object({
  password: passwordSchema,
  role: z.enum(["GENERAL", "ADMIN"]),
});

// 消費税率は0〜100の整数のみ(決定事項No.30・37)
export const taxRateFormSchema = z.object({
  ratePercent: z
    .number()
    .int("消費税率は整数(%)で入力してください。小数点以下は指定できません。")
    .min(0, "消費税率は0%以上で入力してください。")
    .max(100, "消費税率は100%以下で入力してください。"),
});
