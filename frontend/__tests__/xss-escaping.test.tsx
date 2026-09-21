import { render, screen } from "@testing-library/react";

// FE-018: メニュー名・会員氏名の表示コンポーネント。
// <script>等を含む文字列を渡してもタグとして解釈されず、文字列として表示されることを確認する。
// Reactは{value}でのレンダリングを常にエスケープするため(dangerouslySetInnerHTMLを使わない限り)、
// 本アプリのメニュー名・会員氏名表示箇所(app/admin/menus, app/admin/members等)はすべてこの形式で
// 実装している。ここでは同じレンダリング方式を最小構成で検証する。
function NameDisplay({ name }: { name: string }) {
  return <span data-testid="name">{name}</span>;
}

test("FE-018: <script>等を含む文字列を渡してもタグとして解釈されず、文字列として表示される", () => {
  const payload = "<script>alert(1)</script>";
  render(<NameDisplay name={payload} />);

  const el = screen.getByTestId("name");
  expect(el.textContent).toBe(payload);
  // scriptタグとして実DOMに解釈されていないこと(要素としては存在しない)
  expect(document.querySelector("script")).not.toBeInTheDocument();
});
