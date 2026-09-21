// バックエンド(FastAPI)のPydanticスキーマ(camelCase)と1対1で対応する型定義。
// 設計仕様書8章のAPI一覧に準拠する。

export type Role = "GENERAL" | "ADMIN";
export type Gender = "MALE" | "FEMALE" | "OTHER" | "NO_ANSWER";

export interface ApiErrorBody {
  error_code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface LoginRequest {
  staffId: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  role: Role;
}

// BFF(Next.js側)のログインAPIレスポンス。JWT本体はHttpOnly Cookieに格納されるため、
// ブラウザJSに返すのはroleのみ(設計仕様書5.1節)。
export interface BffLoginResponse {
  role: Role;
}

export interface MeResponse {
  staffId: string;
  role: Role;
}

export interface MemberLookup {
  memberId: string;
}

export interface Member {
  memberId: string;
  name: string;
  phone: string;
  address: string;
  gender: Gender;
  age: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MemberCreateInput {
  name: string;
  phone: string;
  address: string;
  gender: Gender;
  age: number;
}

export interface MemberUpdateInput {
  name?: string;
  phone?: string;
  address?: string;
  gender?: Gender;
  age?: number;
  isActive?: boolean;
}

export interface MenuLookup {
  menuNo: string;
  name: string;
  price: number;
}

export interface Menu {
  menuNo: string;
  name: string;
  price: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MenuCreateInput {
  name: string;
  price: number;
}

export interface MenuUpdateInput {
  name?: string;
  price?: number;
  isActive?: boolean;
}

export interface Staff {
  staffId: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StaffCreateInput {
  password: string;
  role: Role;
}

export interface StaffUpdateInput {
  password?: string;
  role?: Role;
  isActive?: boolean;
}

export interface TaxRateResponse {
  ratePercent: number;
}

// 購入リストの1行(会計確定前。フロントエンドstate内のみで完結する。設計8章)
export interface CartItem {
  menuNo: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface TransactionItem {
  menuNo: string;
  quantity: number;
}

export interface TransactionCreateRequest {
  memberId: string | null;
  items: TransactionItem[];
  frontendCalculated: {
    totalWithTax: number;
    totalWithoutTax: number;
  };
}

export interface TransactionCreateResponse {
  transactionId: number;
  totalWithTax: number;
  totalWithoutTax: number;
}
