// バーコード種別の判別(要件3.3節・決定事項No.14)。
// メニュー番号は4桁、会員IDは8桁のため、読み取った数字の桁数で自動的に区別する。

export type BarcodeType = "MENU" | "MEMBER" | "INVALID";

export function classifyBarcode(raw: string): BarcodeType {
  if (!/^\d+$/.test(raw)) {
    return "INVALID";
  }
  if (raw.length === 4) {
    return "MENU";
  }
  if (raw.length === 8) {
    return "MEMBER";
  }
  return "INVALID";
}
