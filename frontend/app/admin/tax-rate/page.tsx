"use client";

import { FormEvent, useEffect, useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import { apiClient, ApiError } from "@/lib/apiClient";
import type { TaxRateResponse } from "@/lib/types";
import { taxRateFormSchema } from "@/lib/validation";

function TaxRateAdminScreen() {
  const [currentRate, setCurrentRate] = useState<number | null>(null);
  const [ratePercentInput, setRatePercentInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    apiClient.get<TaxRateResponse>("/api/tax-rate").then((res) => setCurrentRate(res.ratePercent));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    // 消費税率は整数(%)のみ(決定事項No.37)。小数点入力はここで弾く
    const numeric = Number(ratePercentInput);
    const parsed = taxRateFormSchema.safeParse({ ratePercent: numeric });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "入力内容を確認してください。");
      return;
    }

    try {
      await apiClient.post("/api/tax-rate", parsed.data);
      setMessage(`消費税率を${parsed.data.ratePercent}%に変更しました。以降の取引に適用されます。`);
      setRatePercentInput("");
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "消費税率の変更に失敗しました。");
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-md flex-1 p-6">
        <h1 className="mb-4 text-xl font-bold">消費税率管理</h1>

        <p className="mb-4 rounded border bg-white p-4">
          現在の消費税率: <span className="font-semibold">{currentRate ?? "-"}%</span>
        </p>

        <form onSubmit={handleSubmit} className="flex items-end gap-2 rounded border bg-white p-4">
          <div>
            <label className="block text-sm text-gray-600">新しい消費税率(0〜100の整数%)</label>
            <input
              className="w-32 rounded border px-2 py-1"
              value={ratePercentInput}
              onChange={(e) => setRatePercentInput(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <button className="rounded bg-blue-600 px-4 py-1.5 text-white" type="submit">
            変更
          </button>
        </form>

        {message && <p className="mt-4 text-sm text-green-700">{message}</p>}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </main>
    </div>
  );
}

export default function TaxRateAdminPage() {
  return (
    <AuthGuard requireAdmin>
      <TaxRateAdminScreen />
    </AuthGuard>
  );
}
