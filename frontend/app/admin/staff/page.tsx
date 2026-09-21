"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { apiClient, ApiError } from "@/lib/apiClient";
import type { Role, Staff } from "@/lib/types";
import { staffFormSchema } from "@/lib/validation";

function StaffAdminScreen() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("GENERAL");
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<Role>("GENERAL");

  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);

  const load = useCallback(() => {
    apiClient
      .get<{ staff: Staff[] }>(`/api/staff?includeDeleted=${includeDeleted}`)
      .then((res) => setStaffList(res.staff))
      .catch((e) => setError(e instanceof ApiError ? e.message : "一覧の取得に失敗しました。"));
  }, [includeDeleted]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = staffFormSchema.safeParse({ password, role });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "入力内容を確認してください。");
      return;
    }
    try {
      await apiClient.post("/api/staff", parsed.data);
      setPassword("");
      setRole("GENERAL");
      load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "登録に失敗しました。");
    }
  }

  function startEdit(staff: Staff) {
    setEditingId(staff.staffId);
    setEditPassword("");
    setEditRole(staff.role);
  }

  async function handleSaveEdit(staff: Staff) {
    const payload: { password?: string; role: Role } = { role: editRole };
    if (editPassword) {
      payload.password = editPassword;
    }
    try {
      await apiClient.put(`/api/staff/${staff.staffId}`, payload);
      setEditingId(null);
      load();
    } catch (e) {
      // 最後の管理者の降格はLAST_ADMIN_PROTECTION(409)としてここに表示される(決定事項No.22)
      setError(e instanceof ApiError ? e.message : "更新に失敗しました。");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await apiClient.delete(`/api/staff/${deleteTarget.staffId}`);
      setDeleteTarget(null);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "削除に失敗しました。");
    }
  }

  async function handleRestore(staff: Staff) {
    try {
      await apiClient.put(`/api/staff/${staff.staffId}`, { isActive: true });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "復元に失敗しました。");
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 p-6">
        <h1 className="mb-4 text-xl font-bold">担当者管理</h1>

        <form onSubmit={handleCreate} className="mb-6 flex flex-wrap items-end gap-2 rounded border bg-white p-4">
          <div>
            <label className="block text-sm text-gray-600">パスワード</label>
            <input
              type="password"
              className="rounded border px-2 py-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600">権限区分</label>
            <select className="rounded border px-2 py-1" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="GENERAL">一般担当者</option>
              <option value="ADMIN">管理者</option>
            </select>
          </div>
          <button className="rounded bg-blue-600 px-4 py-1.5 text-white" type="submit">
            登録
          </button>
          {formError && <p className="w-full text-sm text-red-600">{formError}</p>}
        </form>

        <label className="mb-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />
          削除済みを表示
        </label>

        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

        <table className="w-full rounded border bg-white text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="p-2">担当者ID</th>
              <th className="p-2">権限区分</th>
              <th className="p-2">状態</th>
              <th className="p-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {staffList.map((staff) => {
              const editing = editingId === staff.staffId;
              return (
                <tr key={staff.staffId} className="border-b">
                  <td className="p-2">{staff.staffId}</td>
                  <td className="p-2">
                    {editing ? (
                      <select className="rounded border px-1" value={editRole} onChange={(e) => setEditRole(e.target.value as Role)}>
                        <option value="GENERAL">一般担当者</option>
                        <option value="ADMIN">管理者</option>
                      </select>
                    ) : staff.role === "ADMIN" ? (
                      "管理者"
                    ) : (
                      "一般担当者"
                    )}
                  </td>
                  <td className="p-2">{staff.isActive ? "有効" : "削除済み"}</td>
                  <td className="flex gap-2 p-2">
                    {editing ? (
                      <>
                        <input
                          type="password"
                          placeholder="変更する場合のみ入力"
                          className="w-40 rounded border px-1"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                        />
                        <button className="text-blue-600" onClick={() => handleSaveEdit(staff)}>
                          保存
                        </button>
                        <button className="text-gray-500" onClick={() => setEditingId(null)}>
                          キャンセル
                        </button>
                      </>
                    ) : staff.isActive ? (
                      <>
                        <button className="text-blue-600" onClick={() => startEdit(staff)}>
                          編集
                        </button>
                        <button className="text-red-600" onClick={() => setDeleteTarget(staff)}>
                          削除
                        </button>
                      </>
                    ) : (
                      <button className="text-green-600" onClick={() => handleRestore(staff)}>
                        復元
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </main>

      {deleteTarget && (
        <ConfirmDialog
          message={`担当者「${deleteTarget.staffId}」を削除します。本当に削除しますか？`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

export default function StaffAdminPage() {
  return (
    <AuthGuard requireAdmin>
      <StaffAdminScreen />
    </AuthGuard>
  );
}
