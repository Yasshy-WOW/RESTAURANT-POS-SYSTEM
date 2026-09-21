"use client";

/**
 * 削除操作前の確認ダイアログ(決定事項No.27)。復元操作は破壊的でないため
 * このダイアログを介さず即座に実行する(決定事項No.36)。
 */
export function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40">
      <div className="w-80 rounded bg-white p-6 shadow-lg">
        <p className="mb-6 text-sm text-gray-800">{message}</p>
        <div className="flex justify-end gap-2">
          <button className="rounded border px-3 py-1" onClick={onCancel}>
            キャンセル
          </button>
          <button className="rounded bg-red-600 px-3 py-1 text-white" onClick={onConfirm}>
            はい
          </button>
        </div>
      </div>
    </div>
  );
}
