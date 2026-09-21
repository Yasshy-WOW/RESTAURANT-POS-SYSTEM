import type { CartItem } from "@/lib/types";

export const MAX_QUANTITY = 99;
export const MIN_QUANTITY = 1;

export interface AddResult {
  cart: CartItem[];
  limitExceeded: boolean;
}

/**
 * 購入リストへの反映ルール(要件3.3.3節)。
 * 既存行があれば数量を+1(上限99個を超える場合は加算せずエラー。決定事項No.16)、
 * なければ新しい1行として追加する。
 */
export function addOrIncrementItem(
  cart: CartItem[],
  item: { menuNo: string; name: string; unitPrice: number }
): AddResult {
  const existing = cart.find((c) => c.menuNo === item.menuNo);
  if (existing) {
    if (existing.quantity >= MAX_QUANTITY) {
      return { cart, limitExceeded: true };
    }
    return {
      cart: cart.map((c) => (c.menuNo === item.menuNo ? { ...c, quantity: c.quantity + 1 } : c)),
      limitExceeded: false,
    };
  }
  return { cart: [...cart, { ...item, quantity: 1 }], limitExceeded: false };
}

export interface QuantityChangeResult {
  cart: CartItem[];
  error: string | null;
}

/** 数量変更(要件3.4.3節)。下限1個・上限99個。0にする場合は削除操作を使う。 */
export function changeQuantity(cart: CartItem[], menuNo: string, newQuantity: number): QuantityChangeResult {
  if (!Number.isInteger(newQuantity) || newQuantity < MIN_QUANTITY) {
    return { cart, error: "数量は1個以上の整数で入力してください(0にする場合は削除操作を行ってください)。" };
  }
  if (newQuantity > MAX_QUANTITY) {
    return { cart, error: `数量は${MAX_QUANTITY}個までです。` };
  }
  return {
    cart: cart.map((c) => (c.menuNo === menuNo ? { ...c, quantity: newQuantity } : c)),
    error: null,
  };
}

export function removeItem(cart: CartItem[], menuNo: string): CartItem[] {
  return cart.filter((c) => c.menuNo !== menuNo);
}

/** 購入リストが0件の場合、購入確定操作はできない(決定事項No.15)。 */
export function canPurchase(cart: CartItem[]): boolean {
  return cart.length > 0;
}
