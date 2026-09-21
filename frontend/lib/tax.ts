// 消費税額の計算(要件3.7節・決定事項No.23・24)。
// バックエンド(app/services/tax_calc.py)とビット単位で完全に一致させる必要があるため
// (設計仕様書5.4節: 丸め方式が少しでも異なるとCALCULATION_MISMATCHが誤発生する)、
// 浮動小数点の除算は一切使わず、BigIntによる厳密な整数演算で四捨五入を行う。

export interface TaxLine {
  unitPrice: number; // 税込み単価(円)
  quantity: number;
}

export interface TaxTotals {
  totalWithTax: number;
  totalWithoutTax: number;
}

/** floor((2*numerator + denominator) / (2*denominator)) = round-half-up(numerator/denominator) (非負整数限定)。 */
function roundHalfUpDiv(numerator: bigint, denominator: bigint): bigint {
  return (2n * numerator + denominator) / (2n * denominator);
}

/** メニュー1行分の税抜き金額を計算する。行ごとに四捨五入する(決定事項No.24)。 */
export function calcLineWithoutTax(unitPrice: number, quantity: number, ratePercent: number): number {
  const lineTotalWithTax = BigInt(unitPrice) * BigInt(quantity);
  const numerator = lineTotalWithTax * 100n;
  const denominator = BigInt(100 + ratePercent);
  return Number(roundHalfUpDiv(numerator, denominator));
}

/**
 * 購入リスト全体の税込み・税抜き合計金額を計算する(要件3.7節)。
 * 税込み合計は単純合計(丸め不要)、税抜き合計は各行を四捨五入してから合計する
 * (税込み合計を先に一括で割り戻すのではない。FT-075で検証)。
 */
export function calcTotals(lines: TaxLine[], ratePercent: number): TaxTotals {
  const totalWithTax = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const totalWithoutTax = lines.reduce(
    (sum, line) => sum + calcLineWithoutTax(line.unitPrice, line.quantity, ratePercent),
    0
  );
  return { totalWithTax, totalWithoutTax };
}
