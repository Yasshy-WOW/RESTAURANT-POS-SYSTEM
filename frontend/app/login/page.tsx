"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/AuthProvider";
import { ApiError } from "@/lib/apiClient";
import { loginSchema } from "@/lib/validation";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [staffId, setStaffId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ staffId, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "入力内容を確認してください。");
      return;
    }

    setSubmitting(true);
    try {
      await login(staffId, password);
      router.push("/pos");
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message);
      } else {
        setError("ログインに失敗しました。");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg bg-white p-8 shadow">
        <h1 className="mb-6 text-xl font-bold text-gray-800">簡易POSアプリ ログイン</h1>

        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="staffId">
          担当者ID
        </label>
        <input
          id="staffId"
          className="mb-4 w-full rounded border border-gray-300 px-3 py-2"
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          maxLength={4}
          inputMode="numeric"
          autoComplete="username"
        />

        <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="password">
          パスワード
        </label>
        <input
          id="password"
          type="password"
          className="mb-4 w-full rounded border border-gray-300 px-3 py-2"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-blue-600 py-2 font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "ログイン中..." : "ログイン"}
        </button>
      </form>
    </main>
  );
}
