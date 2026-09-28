/**
 * 必須環境変数を取得する。未設定ならエラーで停止する。
 *
 * `const v = process.env.X; if (!v) throw ...;` という書き方だと、vを参照する処理が
 * 別関数(クロージャ)の中にある場合にTypeScriptの型の絞り込みが効かず
 * `string | undefined` のままになってしまう。戻り値の型注釈で `string` を保証することで
 * この問題を避ける。
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`環境変数${name}を設定してください(backend/.envのINITIAL_ADMIN_PASSWORDと同じ値)。`);
  }
  return value;
}
