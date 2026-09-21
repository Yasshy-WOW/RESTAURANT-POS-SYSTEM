"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { useRouter } from "next/navigation";

import { apiClient, setAuthExpiredHandler } from "@/lib/apiClient";
import type { BffLoginResponse, MeResponse, Role } from "@/lib/types";

interface AuthState {
  staffId: string;
  role: Role;
}

interface AuthContextValue {
  auth: AuthState | null;
  loading: boolean;
  login: (staffId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const clearAndRedirectToLogin = useCallback(() => {
    // JWT期限切れ時: 作成中の購入リスト等のクライアント状態は破棄してよい(決定事項No.28)
    setAuth(null);
    router.push("/login");
  }, [router]);

  useEffect(() => {
    setAuthExpiredHandler(clearAndRedirectToLogin);
    return () => setAuthExpiredHandler(null);
  }, [clearAndRedirectToLogin]);

  useEffect(() => {
    // 画面リロード時、Cookieが有効であればログイン状態を復元する
    apiClient
      .get<MeResponse>("/api/auth/me")
      .then((me) => setAuth({ staffId: me.staffId, role: me.role }))
      .catch(() => setAuth(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (staffId: string, password: string) => {
    await apiClient.post<BffLoginResponse>("/api/auth/login", { staffId, password });
    const me = await apiClient.get<MeResponse>("/api/auth/me");
    setAuth({ staffId: me.staffId, role: me.role });
  }, []);

  const logout = useCallback(async () => {
    await apiClient.post("/api/auth/logout");
    setAuth(null);
    router.push("/login");
  }, [router]);

  return <AuthContext.Provider value={{ auth, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
