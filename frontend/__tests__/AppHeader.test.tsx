import { render, screen } from "@testing-library/react";

import { AppHeader } from "@/components/AppHeader";

const mockUseAuth = jest.fn();

jest.mock("@/components/AuthProvider", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("next/link", () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

test("FE-012: role: 'GENERAL'のユーザーにはマスタメンテナンス導線が表示されない", () => {
  mockUseAuth.mockReturnValue({ auth: { staffId: "0002", role: "GENERAL" }, logout: jest.fn() });
  render(<AppHeader />);
  expect(screen.queryByText("担当者管理")).not.toBeInTheDocument();
  expect(screen.queryByText("会員管理")).not.toBeInTheDocument();
  expect(screen.queryByText("メニュー管理")).not.toBeInTheDocument();
  expect(screen.queryByText("消費税率管理")).not.toBeInTheDocument();
});

test("role: 'ADMIN'のユーザーにはマスタメンテナンス導線が表示される", () => {
  mockUseAuth.mockReturnValue({ auth: { staffId: "0001", role: "ADMIN" }, logout: jest.fn() });
  render(<AppHeader />);
  expect(screen.getByText("担当者管理")).toBeInTheDocument();
  expect(screen.getByText("消費税率管理")).toBeInTheDocument();
});
