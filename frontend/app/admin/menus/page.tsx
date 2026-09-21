"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { apiClient, ApiError } from "@/lib/apiClient";
import type { Menu } from "@/lib/types";
import { menuFormSchema } from "@/lib/validation";

function MenuAdminScreen() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [editingMenuNo, setEditingMenuNo] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<Menu | null>(null);

  const load = useCallback(() => {
    apiClient
      .get<{ menus: Menu[] }>(`/api/menus?includeDeleted=${includeDeleted}`)
      .then((res) => setMenus(res.menus))
      .catch((e) => setError(e instanceof ApiError ? e.message : "一覧の取得に失敗しました。"));
  }, [includeDeleted]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = menuFormSchema.safeParse({ name, price: Number(price) });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "入力内容を確認してください。");
      return;
    }
    try {
      await apiClient.post("/api/menus", parsed.data);
      setName("");
      setPrice("");
      load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "登録に失敗しました。");
    }
  }

  function startEdit(menu: Menu) {
    setEditingMenuNo(menu.menuNo);
    setEditName(menu.name);
    setEditPrice(String(menu.price));
  }

  async function handleSaveEdit(menu: Menu) {
    const parsed = menuFormSchema.safeParse({ name: editName, price: Number(editPrice) });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "入力内容を確認してください。");
      return;
    }
    try {
      await apiClient.put(`/api/menus/${menu.menuNo}`, parsed.data);
      setEditingMenuNo(null);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "更新に失敗しました。");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await apiClient.delete(`/api/menus/${deleteTarget.menuNo}`);
      setDeleteTarget(null);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "削除に失敗しました。");
    }
  }

  async function handleRestore(menu: Menu) {
    try {
      await apiClient.put(`/api/menus/${menu.menuNo}`, { isActive: true });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "復元に失敗しました。");
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 p-6">
        <h1 className="mb-4 text-xl font-bold">メニュー管理</h1>

        <form onSubmit={handleCreate} className="mb-6 flex flex-wrap items-end gap-2 rounded border bg-white p-4">
          <div>
            <label className="block text-sm text-gray-600">メニュー名</label>
            <input className="rounded border px-2 py-1" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-600">単価(税込・円)</label>
            <input
              className="w-28 rounded border px-2 py-1"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <button className="rounded bg-blue-600 px-4 py-1.5 text-white" type="submit">
            登録
          </button>
          {formError && <p className="w-full text-sm text-red-600">{formError}</p>}
        </form>

        <label className="mb-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(e) => setIncludeDeleted(e.target.checked)}
          />
          削除済みを表示
        </label>

        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

        <table className="w-full rounded border bg-white text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="p-2">番号</th>
              <th className="p-2">名称</th>
              <th className="p-2">単価</th>
              <th className="p-2">状態</th>
              <th className="p-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {menus.map((menu) => (
              <tr key={menu.menuNo} className="border-b">
                <td className="p-2">{menu.menuNo}</td>
                <td className="p-2">
                  {editingMenuNo === menu.menuNo ? (
                    <input className="rounded border px-1" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  ) : (
                    menu.name
                  )}
                </td>
                <td className="p-2">
                  {editingMenuNo === menu.menuNo ? (
                    <input
                      className="w-24 rounded border px-1"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      inputMode="numeric"
                    />
                  ) : (
                    `${menu.price.toLocaleString()}円`
                  )}
                </td>
                <td className="p-2">{menu.isActive ? "有効" : "削除済み"}</td>
                <td className="flex gap-2 p-2">
                  {editingMenuNo === menu.menuNo ? (
                    <>
                      <button className="text-blue-600" onClick={() => handleSaveEdit(menu)}>
                        保存
                      </button>
                      <button className="text-gray-500" onClick={() => setEditingMenuNo(null)}>
                        キャンセル
                      </button>
                    </>
                  ) : menu.isActive ? (
                    <>
                      <button className="text-blue-600" onClick={() => startEdit(menu)}>
                        編集
                      </button>
                      <button className="text-red-600" onClick={() => setDeleteTarget(menu)}>
                        削除
                      </button>
                    </>
                  ) : (
                    <button className="text-green-600" onClick={() => handleRestore(menu)}>
                      復元
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>

      {deleteTarget && (
        <ConfirmDialog
          message={`メニュー「${deleteTarget.name}」を削除します。本当に削除しますか？`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

export default function MenuAdminPage() {
  return (
    <AuthGuard requireAdmin>
      <MenuAdminScreen />
    </AuthGuard>
  );
}
