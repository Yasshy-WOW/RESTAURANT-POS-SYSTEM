"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { apiClient, ApiError } from "@/lib/apiClient";
import type { Gender, Member } from "@/lib/types";
import { memberFormSchema } from "@/lib/validation";

const GENDER_LABEL: Record<Gender, string> = {
  MALE: "男性",
  FEMALE: "女性",
  OTHER: "その他",
  NO_ANSWER: "回答しない",
};

interface MemberForm {
  name: string;
  phone: string;
  address: string;
  gender: Gender;
  age: string;
}

const EMPTY_FORM: MemberForm = { name: "", phone: "", address: "", gender: "NO_ANSWER", age: "" };

function MemberAdminScreen() {
  const [members, setMembers] = useState<Member[]>([]);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<MemberForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<MemberForm>(EMPTY_FORM);

  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);

  const load = useCallback(() => {
    apiClient
      .get<{ members: Member[] }>(`/api/members?includeDeleted=${includeDeleted}`)
      .then((res) => setMembers(res.members))
      .catch((e) => setError(e instanceof ApiError ? e.message : "一覧の取得に失敗しました。"));
  }, [includeDeleted]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    const parsed = memberFormSchema.safeParse({ ...form, age: Number(form.age) });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "入力内容を確認してください。");
      return;
    }
    try {
      await apiClient.post("/api/members", parsed.data);
      setForm(EMPTY_FORM);
      load();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "登録に失敗しました。");
    }
  }

  function startEdit(member: Member) {
    setEditingId(member.memberId);
    setEditForm({
      name: member.name,
      phone: member.phone,
      address: member.address,
      gender: member.gender,
      age: String(member.age),
    });
  }

  async function handleSaveEdit(member: Member) {
    const parsed = memberFormSchema.safeParse({ ...editForm, age: Number(editForm.age) });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "入力内容を確認してください。");
      return;
    }
    try {
      await apiClient.put(`/api/members/${member.memberId}`, parsed.data);
      setEditingId(null);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "更新に失敗しました。");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await apiClient.delete(`/api/members/${deleteTarget.memberId}`);
      setDeleteTarget(null);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "削除に失敗しました。");
    }
  }

  async function handleRestore(member: Member) {
    try {
      await apiClient.put(`/api/members/${member.memberId}`, { isActive: true });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "復元に失敗しました。");
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 p-6">
        <h1 className="mb-4 text-xl font-bold">会員管理</h1>

        <form onSubmit={handleCreate} className="mb-6 flex flex-wrap items-end gap-2 rounded border bg-white p-4">
          <div>
            <label className="block text-sm text-gray-600">氏名</label>
            <input className="rounded border px-2 py-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm text-gray-600">電話番号</label>
            <input className="rounded border px-2 py-1" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm text-gray-600">住所</label>
            <input className="rounded border px-2 py-1" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm text-gray-600">性別</label>
            <select
              className="rounded border px-2 py-1"
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value as Gender })}
            >
              {Object.entries(GENDER_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600">年齢</label>
            <input className="w-20 rounded border px-2 py-1" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} inputMode="numeric" />
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
              <th className="p-2">会員ID</th>
              <th className="p-2">氏名</th>
              <th className="p-2">電話番号</th>
              <th className="p-2">住所</th>
              <th className="p-2">性別</th>
              <th className="p-2">年齢</th>
              <th className="p-2">状態</th>
              <th className="p-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const editing = editingId === member.memberId;
              return (
                <tr key={member.memberId} className="border-b">
                  <td className="p-2">{member.memberId}</td>
                  <td className="p-2">
                    {editing ? (
                      <input className="rounded border px-1" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                    ) : (
                      member.name
                    )}
                  </td>
                  <td className="p-2">
                    {editing ? (
                      <input className="rounded border px-1" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                    ) : (
                      member.phone
                    )}
                  </td>
                  <td className="p-2">
                    {editing ? (
                      <input className="rounded border px-1" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                    ) : (
                      member.address
                    )}
                  </td>
                  <td className="p-2">
                    {editing ? (
                      <select
                        className="rounded border px-1"
                        value={editForm.gender}
                        onChange={(e) => setEditForm({ ...editForm, gender: e.target.value as Gender })}
                      >
                        {Object.entries(GENDER_LABEL).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      GENDER_LABEL[member.gender]
                    )}
                  </td>
                  <td className="p-2">
                    {editing ? (
                      <input className="w-16 rounded border px-1" value={editForm.age} onChange={(e) => setEditForm({ ...editForm, age: e.target.value })} inputMode="numeric" />
                    ) : (
                      member.age
                    )}
                  </td>
                  <td className="p-2">{member.isActive ? "有効" : "削除済み"}</td>
                  <td className="flex gap-2 p-2">
                    {editing ? (
                      <>
                        <button className="text-blue-600" onClick={() => handleSaveEdit(member)}>
                          保存
                        </button>
                        <button className="text-gray-500" onClick={() => setEditingId(null)}>
                          キャンセル
                        </button>
                      </>
                    ) : member.isActive ? (
                      <>
                        <button className="text-blue-600" onClick={() => startEdit(member)}>
                          編集
                        </button>
                        <button className="text-red-600" onClick={() => setDeleteTarget(member)}>
                          削除
                        </button>
                      </>
                    ) : (
                      <button className="text-green-600" onClick={() => handleRestore(member)}>
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
          message={`会員「${deleteTarget.name}」を削除します。本当に削除しますか？`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

export default function MemberAdminPage() {
  return (
    <AuthGuard requireAdmin>
      <MemberAdminScreen />
    </AuthGuard>
  );
}
