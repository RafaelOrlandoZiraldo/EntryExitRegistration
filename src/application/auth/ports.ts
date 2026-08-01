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
