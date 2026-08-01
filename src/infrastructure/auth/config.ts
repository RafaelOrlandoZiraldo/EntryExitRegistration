import { z } from "zod";
import type { AuthConfig } from "@application/auth";

const envSchema = z.object({
  VITE_AUTH_USERNAME: z.string().trim().min(1),
  VITE_AUTH_PASSWORD_HASH: z.string().trim().min(1).refine(isValidBase64),
  VITE_AUTH_PASSWORD_SALT: z.string().trim().min(1).refine(isValidBase64),
  VITE_AUTH_PASSWORD_ITERATIONS: z.coerce.number().int().positive(),
  VITE_SESSION_TIMEOUT_MINUTES: z.coerce.number().int().positive()
});

export type AuthEnvironment = z.input<typeof envSchema>;

export function parseAuthConfig(env: AuthEnvironment): AuthConfig | null {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    return null;
  }

  return {
    username: result.data.VITE_AUTH_USERNAME,
    passwordHash: result.data.VITE_AUTH_PASSWORD_HASH,
    passwordSalt: result.data.VITE_AUTH_PASSWORD_SALT,
    passwordIterations: result.data.VITE_AUTH_PASSWORD_ITERATIONS,
    sessionTimeoutMinutes: result.data.VITE_SESSION_TIMEOUT_MINUTES
  };
}

export function readAuthConfigFromEnv() {
  const username = import.meta.env.VITE_AUTH_USERNAME;
  const passwordHash = import.meta.env.VITE_AUTH_PASSWORD_HASH;
  const passwordSalt = import.meta.env.VITE_AUTH_PASSWORD_SALT;
  const passwordIterations = import.meta.env.VITE_AUTH_PASSWORD_ITERATIONS;
  const sessionTimeoutMinutes = import.meta.env.VITE_SESSION_TIMEOUT_MINUTES;

  return parseAuthConfig({
    VITE_AUTH_USERNAME: username,
    VITE_AUTH_PASSWORD_HASH: passwordHash,
    VITE_AUTH_PASSWORD_SALT: passwordSalt,
    VITE_AUTH_PASSWORD_ITERATIONS: passwordIterations,
    VITE_SESSION_TIMEOUT_MINUTES: sessionTimeoutMinutes
  });
}

function isValidBase64(value: string) {
  try {
    return base64ToBytes(value).length > 0;
  } catch {
    return false;
  }
}

export function base64ToBytes(value: string) {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}
