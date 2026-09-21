"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { apiClient, ApiError } from "@/lib/apiClient";
import { classifyBarcode } from "@/lib/barcode";
import { addOrIncrementItem, canPurchase, changeQuantity, MAX_QUANTITY, removeItem } from "@/lib/cart";
import { calcTotals } from "@/lib/tax";
import type { CartItem, MemberLookup, MenuLookup, TaxRateResponse, TransactionCreateResponse } from "@/lib/types";
import { memberIdSchema, menuNoSchema } from "@/lib/validation";

function PosScreen() {
  const [taxRatePercent, setTaxRatePercent] = useState<number | null>(null);

  // 会員ID(要件3.2節)。一度読み込む(または「お客様ID読み込み」)と訂正不可(決定事項No.19)
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberResolved, setMemberResolved] = useState(false);
  const [memberIdInput, setMemberIdInput] = useState("");
  const [memberError, setMemberError] = useState<string | null>(null);

  // メニュー番号手入力(要件3.3.1)
  const [menuNoInput, setMenuNoInput] = useState("");
  const [menuLookup, setMenuLookup] = useState<MenuLookup | null>(null);
  const [menuError, setMenuError] = useState<string | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedMenuNo, setSelectedMenuNo] = useState<string | null>(null);
  const [quantityDraft, setQuantityDraft] = useState<string>("");
  const [cartError, setCartError] = useState<string | null>(null);

  const [scannerActive, setScannerActive] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);

  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [confirmResult, setConfirmResult] = useState<TransactionCreateResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiClient.get<TaxRateResponse>("/api/tax-rate").then((res) => setTaxRatePercent(res.ratePercent));
  }, []);

  const cartTotals = useMemo(() => {
    if (taxRatePercent === null) return { totalWithTax: 0, totalWithoutTax: 0 };
    return calcTotals(
      cart.map((item) => ({ unitPrice: item.unitPrice, quantity: item.quantity })),
      taxRatePercent
    );
  }, [cart, taxRatePercent]);

  const selectedItem = cart.find((item) => item.menuNo === selectedMenuNo) ?? null;

  async function handleLoadMember(id: string) {
    setMemberError(null);
    const parsed = memberIdSchema.safeParse(id);
    if (!parsed.success) {
      setMemberError(parsed.error.issues[0]?.message ?? "会員IDの形式が不正です。");
      return;
    }
    try {
      const result = await apiClient.get<MemberLookup>(`/api/members/${id}`);
      setMemberId(result.memberId);
      setMemberResolved(true);
    } catch (e) {
      if (e instanceof ApiError) {
        setMemberError(e.message);
      }
    }
  }

  function handleSkipMember() {
    // 「お客様ID読み込みボタン」: 会員なしの通常取引として進める(要件3.2節)
    setMemberId(null);
    setMemberResolved(true);
    setMemberError(null);
  }

  function addOrIncrementCart(menuNo: string, name: string, price: number): boolean {
    let ok = true;
    setCart((prev) => {
      const result = addOrIncrementItem(prev, { menuNo, name, unitPrice: price });
      ok = !result.limitExceeded;
      return result.cart;
    });
    return ok;
  }

  async function handleLookupMenu(rawMenuNo: string) {
    setMenuError(null);
    setMenuLookup(null);
    const parsed = menuNoSchema.safeParse(rawMenuNo);
    if (!parsed.success) {
      setMenuError(parsed.error.issues[0]?.message ?? "メニュー番号の形式が不正です。");
      return;
    }
    try {
      const result = await apiClient.get<MenuLookup>(`/api/menus/${rawMenuNo}`);
      setMenuLookup(result);
    } catch (e) {
      if (e instanceof ApiError) {
        setMenuError(e.message);
      }
    }
  }

  function handleAddLookedUpMenu() {
    if (!menuLookup) return;
    const ok = addOrIncrementCart(menuLookup.menuNo, menuLookup.name, menuLookup.price);
    if (!ok) {
      setCartError(`「${menuLookup.name}」は数量の上限(${MAX_QUANTITY}個)に達しています。`);
      return;
    }
    setCartError(null);
    // 追加後、番号入力欄・名称表示・単価表示をクリアする(要件3.3.1)
    setMenuNoInput("");
    setMenuLookup(null);
    setMenuError(null);
  }

  const handleBarcodeDetect = useCallback(
    async (raw: string) => {
      const type = classifyBarcode(raw);
      if (type === "INVALID") {
        setScanFeedback("読み取れませんでした。もう一度スキャンしてください。");
        return;
      }
      if (type === "MEMBER") {
        if (memberResolved) {
          return; // 訂正不可(決定事項No.19)。スキャンは無視する
        }
        await handleLoadMember(raw);
        setScanFeedback(null);
        return;
      }
      // MENU: 検索して即座に購入リストへ追加する(要件3.3.2)
      try {
        const result = await apiClient.get<MenuLookup>(`/api/menus/${raw}`);
        const ok = addOrIncrementCart(result.menuNo, result.name, result.price);
        if (!ok) {
          setScanFeedback(`「${result.name}」は数量の上限(${MAX_QUANTITY}個)に達しています。`);
        } else {
          setScanFeedback(`「${result.name}」を1件追加しました。`);
        }
      } catch (e) {
        if (e instanceof ApiError) {
          setScanFeedback(e.message);
        }
      }
    },
    [memberResolved]
  );

  function handleSelectRow(menuNo: string) {
    setSelectedMenuNo((prev) => (prev === menuNo ? null : menuNo));
    setQuantityDraft("");
    setCartError(null);
  }

  function handleDeleteSelected() {
    if (!selectedMenuNo) return;
    setCart((prev) => removeItem(prev, selectedMenuNo));
    setSelectedMenuNo(null);
  }

  function handleChangeQuantity() {
    if (!selectedItem) return;
    const result = changeQuantity(cart, selectedItem.menuNo, Number(quantityDraft));
    if (result.error) {
      setCartError(result.error);
      return;
    }
    setCart(result.cart);
    setCartError(null);
    setQuantityDraft("");
  }

  async function handlePurchase() {
    if (cart.length === 0 || taxRatePercent === null) return;
    setSubmitting(true);
    setPurchaseError(null);
    const totals = calcTotals(
      cart.map((item) => ({ unitPrice: item.unitPrice, quantity: item.quantity })),
      taxRatePercent
    );
    try {
      const result = await apiClient.post<TransactionCreateResponse>("/api/transactions", {
        memberId: memberResolved ? memberId : null,
        items: cart.map((item) => ({ menuNo: item.menuNo, quantity: item.quantity })),
        frontendCalculated: totals,
      });
      setConfirmResult(result);
    } catch (e) {
      if (e instanceof ApiError) {
        // 保存失敗時も購入リストはクリアせず保持する(決定事項No.29)
        setPurchaseError(e.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleClosePopup() {
    // ポップアップを閉じると、次の会員ID登録から再開できる状態に戻す(要件3.6節)
    setConfirmResult(null);
    setCart([]);
    setSelectedMenuNo(null);
    setMenuNoInput("");
    setMenuLookup(null);
    setMenuError(null);
    setMemberId(null);
    setMemberResolved(false);
    setMemberIdInput("");
    setMemberError(null);
    setPurchaseError(null);
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-6">
        <section className="rounded border bg-white p-4">
          <h2 className="mb-2 font-semibold">会員ID</h2>
          {memberResolved ? (
            <p className="text-sm text-gray-700">{memberId ? `会員ID: ${memberId}` : "会員なし"}</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="rounded border px-2 py-1"
                value={memberIdInput}
                onChange={(e) => setMemberIdInput(e.target.value)}
                maxLength={8}
                inputMode="numeric"
                placeholder="会員ID(8桁)"
              />
              <button className="rounded border px-3 py-1" onClick={() => handleLoadMember(memberIdInput)}>
                会員ID読み込み
              </button>
              <button className="rounded border px-3 py-1" onClick={handleSkipMember}>
                お客様ID読み込み(会員なし)
              </button>
              {memberError && <p className="w-full text-sm text-red-600">{memberError}</p>}
            </div>
          )}
        </section>

        <section className="rounded border bg-white p-4">
          <h2 className="mb-2 font-semibold">メニュー登録</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="rounded border px-2 py-1"
              value={menuNoInput}
              onChange={(e) => setMenuNoInput(e.target.value)}
              maxLength={4}
              inputMode="numeric"
              placeholder="メニュー番号(4桁)"
            />
            <button className="rounded border px-3 py-1" onClick={() => handleLookupMenu(menuNoInput)}>
              読み込み
            </button>
            <button className="rounded border px-3 py-1" onClick={() => setScannerActive((v) => !v)}>
              {scannerActive ? "カメラを閉じる" : "バーコードスキャン"}
            </button>
          </div>
          {menuError && <p className="mt-2 text-sm text-red-600">{menuError}</p>}
          {menuLookup && (
            <div className="mt-2 flex items-center gap-3 text-sm">
              <span>{menuLookup.name}</span>
              <span>{menuLookup.price.toLocaleString()}円(税込)</span>
              <button className="rounded bg-blue-600 px-3 py-1 text-white" onClick={handleAddLookedUpMenu}>
                購入リストへ追加
              </button>
            </div>
          )}
          {scannerActive && (
            <div className="mt-3">
              <BarcodeScanner active={scannerActive} onDetect={handleBarcodeDetect} />
              {scanFeedback && <p className="mt-2 text-sm text-gray-700">{scanFeedback}</p>}
            </div>
          )}
        </section>

        <section className="rounded border bg-white p-4">
          <h2 className="mb-2 font-semibold">購入リスト</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-1">名称</th>
                <th className="py-1">数量</th>
                <th className="py-1">単価</th>
                <th className="py-1">小計</th>
              </tr>
            </thead>
            <tbody>
              {cart.map((item) => (
                <tr
                  key={item.menuNo}
                  onClick={() => handleSelectRow(item.menuNo)}
                  className={`cursor-pointer border-b ${
                    selectedMenuNo === item.menuNo ? "bg-blue-100" : "hover:bg-gray-50"
                  }`}
                >
                  <td className="py-1">{item.name}</td>
                  <td className="py-1">{item.quantity}</td>
                  <td className="py-1">{item.unitPrice.toLocaleString()}円</td>
                  <td className="py-1">{(item.unitPrice * item.quantity).toLocaleString()}円</td>
                </tr>
              ))}
              {cart.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-gray-400">
                    購入リストは空です
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {selectedItem && (
            <div className="mt-3 flex items-center gap-2 border-t pt-3 text-sm">
              <span>選択中: {selectedItem.name}</span>
              <input
                className="w-20 rounded border px-2 py-1"
                value={quantityDraft}
                onChange={(e) => setQuantityDraft(e.target.value)}
                placeholder={String(selectedItem.quantity)}
                inputMode="numeric"
              />
              <button className="rounded border px-3 py-1" onClick={handleChangeQuantity}>
                数量変更
              </button>
              <button className="rounded border border-red-400 px-3 py-1 text-red-600" onClick={handleDeleteSelected}>
                削除
              </button>
            </div>
          )}
          {cartError && <p className="mt-2 text-sm text-red-600">{cartError}</p>}

          <p className="mt-3 text-right font-semibold">合計(税込): {cartTotals.totalWithTax.toLocaleString()}円</p>
        </section>

        {purchaseError && <p className="text-sm text-red-600">{purchaseError}</p>}

        <button
          className="self-end rounded bg-green-600 px-6 py-2 font-semibold text-white disabled:opacity-40"
          disabled={!canPurchase(cart) || submitting}
          onClick={handlePurchase}
        >
          購入
        </button>
      </main>

      {confirmResult && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40">
          <div className="w-80 rounded bg-white p-6 text-center shadow-lg">
            <h3 className="mb-4 text-lg font-bold">購入確定</h3>
            <p>税込み合計: {confirmResult.totalWithTax.toLocaleString()}円</p>
            <p>税抜き合計: {confirmResult.totalWithoutTax.toLocaleString()}円</p>
            <button className="mt-6 rounded bg-blue-600 px-4 py-2 text-white" onClick={handleClosePopup}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PosPage() {
  return (
    <AuthGuard>
      <PosScreen />
    </AuthGuard>
  );
}
