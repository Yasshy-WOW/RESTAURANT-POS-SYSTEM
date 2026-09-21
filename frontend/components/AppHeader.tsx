"use client";

import Link from "next/link";

import { useAuth } from "@/components/AuthProvider";

export function AppHeader() {
  const { auth, logout } = useAuth();

  if (!auth) return null;

  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-3 shadow-sm">
      <div className="flex items-center gap-6">
        <Link href="/pos" className="font-bold text-gray-800">
          簡易POSアプリ
        </Link>
        {auth.role === "ADMIN" && (
          <nav className="flex gap-4 text-sm text-gray-600">
            <Link href="/admin/staff">担当者管理</Link>
            <Link href="/admin/members">会員管理</Link>
            <Link href="/admin/menus">メニュー管理</Link>
            <Link href="/admin/tax-rate">消費税率管理</Link>
          </nav>
        )}
      </div>
      <div className="flex items-center gap-4 text-sm text-gray-600">
        <span>
          担当者: {auth.staffId}({auth.role === "ADMIN" ? "管理者" : "一般担当者"})
        </span>
        <button onClick={() => logout()} className="rounded border px-3 py-1 hover:bg-gray-100">
          ログアウト
        </button>
      </div>
    </header>
  );
}
