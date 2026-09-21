"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/AuthProvider";

/**
 * 未ログイン時はログイン画面へ、requireAdmin指定時に一般担当者がアクセスした場合は
 * マスタメンテナンス画面への導線を表示しない(要件3.8節・決定事項No.10)。
 * ただし実際の権限判定は必ずバックエンド側の403判定に依存する(多層防御。設計5.1節)。
 */
export function AuthGuard({ children, requireAdmin = false }: { children: ReactNode; requireAdmin?: boolean }) {
  const { auth, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!auth) {
      router.replace("/login");
    }
  }, [auth, loading, router]);

  if (loading || !auth) {
    return <div className="p-8 text-center text-gray-500">読み込み中...</div>;
  }

  if (requireAdmin && auth.role !== "ADMIN") {
    return (
      <div className="p-8 text-center text-red-600">
        この画面にアクセスする権限がありません。
      </div>
    );
  }

  return <>{children}</>;
}
