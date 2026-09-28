import { render, screen } from "@testing-library/react";

import { AuthGuard } from "@/components/AuthGuard";

const mockUseAuth = jest.fn();
const mockReplace = jest.fn();

jest.mock("@/components/AuthProvider", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

beforeEach(() => {
  mockReplace.mockClear();
});

test("loading中は「読み込み中...」を表示し、子要素は表示しない", () => {
  mockUseAuth.mockReturnValue({ auth: null, loading: true });
  render(
    <AuthGuard>
      <p>保護対象コンテンツ</p>
    </AuthGuard>
  );
  expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  expect(screen.queryByText("保護対象コンテンツ")).not.toBeInTheDocument();
});

test("未ログイン時はログイン画面へリダイレクトする", () => {
  mockUseAuth.mockReturnValue({ auth: null, loading: false });
  render(
    <AuthGuard>
      <p>保護対象コンテンツ</p>
    </AuthGuard>
  );
  expect(mockReplace).toHaveBeenCalledWith("/login");
  expect(screen.queryByText("保護対象コンテンツ")).not.toBeInTheDocument();
});

test("requireAdmin指定時に一般担当者がアクセスするとアクセス権限がない旨を表示する(決定事項No.10)", () => {
  mockUseAuth.mockReturnValue({ auth: { staffId: "0002", role: "GENERAL" }, loading: false });
  render(
    <AuthGuard requireAdmin>
      <p>管理者専用コンテンツ</p>
    </AuthGuard>
  );
  expect(screen.getByText("この画面にアクセスする権限がありません。")).toBeInTheDocument();
  expect(screen.queryByText("管理者専用コンテンツ")).not.toBeInTheDocument();
  expect(mockReplace).not.toHaveBeenCalled();
});

test("requireAdmin指定時に管理者がアクセスすると子要素が表示される", () => {
  mockUseAuth.mockReturnValue({ auth: { staffId: "0001", role: "ADMIN" }, loading: false });
  render(
    <AuthGuard requireAdmin>
      <p>管理者専用コンテンツ</p>
    </AuthGuard>
  );
  expect(screen.getByText("管理者専用コンテンツ")).toBeInTheDocument();
});

test("requireAdmin未指定時は一般担当者でも子要素が表示される", () => {
  mockUseAuth.mockReturnValue({ auth: { staffId: "0002", role: "GENERAL" }, loading: false });
  render(
    <AuthGuard>
      <p>保護対象コンテンツ</p>
    </AuthGuard>
  );
  expect(screen.getByText("保護対象コンテンツ")).toBeInTheDocument();
});
