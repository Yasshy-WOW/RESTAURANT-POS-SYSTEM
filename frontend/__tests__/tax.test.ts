import { calcLineWithoutTax, calcTotals } from "@/lib/tax";

test("FE-007: 税込み→税抜き逆算(端数なし)", () => {
  expect(calcLineWithoutTax(110, 1, 10)).toBe(100);
});

test("FE-008: 端数が出る単価(111円・税率10%)で正しく四捨五入される(FT-043)", () => {
  expect(calcLineWithoutTax(111, 1, 10)).toBe(101); // 111/1.1=100.90... -> 101
});

test("FT-075: 行ごと計算と一括計算で結果が異なるケース", () => {
  const totals = calcTotals(
    [
      { unitPrice: 105, quantity: 1 },
      { unitPrice: 105, quantity: 1 },
    ],
    10
  );
  expect(totals.totalWithTax).toBe(210);
  // 各行で105/1.1=95.45...->95円を2行分。210を一括で割り戻すと191円になり結果が異なる
  expect(totals.totalWithoutTax).toBe(190);
});
