export interface AuthConfig {
  username: string;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  sessionTimeoutMinutes: number;
}

export interface AuthSession {
  userId: string;
  username: string;
  role: "admin" | "user";
  expiresAt: number;
}

export interface PasswordVerificationInput {
  password: string;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
}
