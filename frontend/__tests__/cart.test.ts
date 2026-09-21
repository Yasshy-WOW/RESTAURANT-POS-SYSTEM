import { addOrIncrementItem, changeQuantity } from "@/lib/cart";
import type { CartItem } from "@/lib/types";

test("FE-004: 購入リストに同じメニューを追加すると数量が+1される", () => {
  const cart: CartItem[] = [{ menuNo: "0001", name: "A", unitPrice: 100, quantity: 1 }];
  const result = addOrIncrementItem(cart, { menuNo: "0001", name: "A", unitPrice: 100 });
  expect(result.limitExceeded).toBe(false);
  expect(result.cart).toEqual([{ menuNo: "0001", name: "A", unitPrice: 100, quantity: 2 }]);
});

test("FE-005: 数量99の状態でさらに追加しようとすると加算せずエラーを返す(境界値: 上限99)", () => {
  const cart: CartItem[] = [{ menuNo: "0001", name: "A", unitPrice: 100, quantity: 99 }];
  const result = addOrIncrementItem(cart, { menuNo: "0001", name: "A", unitPrice: 100 });
  expect(result.limitExceeded).toBe(true);
  expect(result.cart[0].quantity).toBe(99);
});

test("FE-006: 数量を0に変更しようとするとエラーになる(境界値: 下限1)", () => {
  const cart: CartItem[] = [{ menuNo: "0001", name: "A", unitPrice: 100, quantity: 1 }];
  const result = changeQuantity(cart, "0001", 0);
  expect(result.error).not.toBeNull();
  expect(result.cart[0].quantity).toBe(1);
});

test("数量98から99への変更は正常に成功する(FT-035相当)", () => {
  const cart: CartItem[] = [{ menuNo: "0001", name: "A", unitPrice: 100, quantity: 98 }];
  const result = changeQuantity(cart, "0001", 99);
  expect(result.error).toBeNull();
  expect(result.cart[0].quantity).toBe(99);
});

test("数量100への変更はエラーになる(FT-034相当)", () => {
  const cart: CartItem[] = [{ menuNo: "0001", name: "A", unitPrice: 100, quantity: 99 }];
  const result = changeQuantity(cart, "0001", 100);
  expect(result.error).not.toBeNull();
  expect(result.cart[0].quantity).toBe(99);
});
