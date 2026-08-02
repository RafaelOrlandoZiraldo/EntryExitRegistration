export interface Env {
  DB: D1Database;
  AUTH_USERNAME: string;
  AUTH_PASSWORD_HASH: string;
  AUTH_PASSWORD_SALT: string;
  AUTH_PASSWORD_ITERATIONS: string;
  AUTH_PASSWORD_ALGORITHM?: string;
  SESSION_SECRET: string;
  SESSION_TIMEOUT_MINUTES: string;
}

export interface FinancialTransaction {
  id: string;
  type: "income" | "expense";
  date: string;
  amount: number;
  category: string;
  description: string;
  paymentMethod: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StorageDocument {
  schemaVersion: 1;
  lastUpdatedAt: string;
  transactions: FinancialTransaction[];
}

export interface AuthSession {
  username: string;
  expiresAt: number;
}

export interface PagesContext {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
}
