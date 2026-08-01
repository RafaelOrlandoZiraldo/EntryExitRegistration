export interface AuthConfig {
  username: string;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  sessionTimeoutMinutes: number;
}

export interface AuthSession {
  username: string;
  expiresAt: number;
}

export interface PasswordVerificationInput {
  password: string;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
}
