import type { AuthSession, PasswordVerificationInput } from "./types";

export interface PasswordVerifier {
  verify(input: PasswordVerificationInput): Promise<boolean>;
}

export interface SessionService {
  create(username: string, timeoutMinutes: number): AuthSession;
  getCurrent(): AuthSession | null;
  touch(timeoutMinutes: number): AuthSession | null;
  clear(): void;
}

export interface AuthClient {
  getCurrent(): Promise<AuthSession | null>;
  login(input: { username: string; password: string }): Promise<AuthSession>;
  logout(): Promise<void>;
  refreshSession(): Promise<AuthSession | null>;
  verifyPassword(password: string): Promise<void>;
}
