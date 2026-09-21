import { classifyBarcode } from "@/lib/barcode";

test("FE-001: classifyBarcode()が4桁の数字を渡すとメニュー番号と判定する", () => {
  expect(classifyBarcode("0001")).toBe("MENU");
});

test("FE-002: classifyBarcode()が8桁の数字を渡すと会員IDと判定する", () => {
  expect(classifyBarcode("00000001")).toBe("MEMBER");
});

test("FE-003: classifyBarcode()が5桁など想定外の桁数を渡すと不正値として扱う", () => {
  expect(classifyBarcode("12345")).toBe("INVALID");
  expect(classifyBarcode("abcd")).toBe("INVALID");
});
