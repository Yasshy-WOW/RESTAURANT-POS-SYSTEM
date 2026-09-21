import { canPurchase } from "@/lib/cart";
import type { CartItem } from "@/lib/types";

test("FE-009: 購入リストが空のとき、購入ボタンが非活性になる", () => {
  expect(canPurchase([])).toBe(false);
});

test("FE-010: 購入リストに1件でもあると購入ボタンが活性になる(境界値: 0件->1件)", () => {
  const cart: CartItem[] = [{ menuNo: "0001", name: "A", unitPrice: 100, quantity: 1 }];
  expect(canPurchase(cart)).toBe(true);
});
