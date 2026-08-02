import type { AuthSession, Env } from "./types";
import { jsonResponse } from "./http";

const sessionCookieName = "domestic_finance_session";

export function validateAuthConfig(env: Env) {
  const passwordHash = readBase64Bytes(env.AUTH_PASSWORD_HASH);
  const passwordSalt = readBase64Bytes(env.AUTH_PASSWORD_SALT);
  const algorithm = getPasswordAlgorithm(env);

  return (
    env.AUTH_USERNAME &&
    env.AUTH_PASSWORD_HASH &&
    env.AUTH_PASSWORD_SALT &&
    env.AUTH_PASSWORD_ITERATIONS &&
    env.SESSION_SECRET &&
    Number.isInteger(Number(env.AUTH_PASSWORD_ITERATIONS)) &&
    Number(env.AUTH_PASSWORD_ITERATIONS) > 0 &&
    Number.isInteger(Number(env.SESSION_TIMEOUT_MINUTES)) &&
    Number(env.SESSION_TIMEOUT_MINUTES) > 0 &&
    passwordHash !== null &&
    passwordHash.byteLength === 32 &&
    passwordSalt !== null &&
    passwordSalt.byteLength > 0 &&
    algorithm !== null
  );
}

export async function verifyPassword(env: Env, password: string) {
  if (!validateAuthConfig(env)) {
    return false;
  }

  try {
    const derivedBytes = await derivePasswordBytes(env, password);

    return constantTimeEqual(
      derivedBytes,
      base64ToBytes(env.AUTH_PASSWORD_HASH)
    );
  } catch {
    return false;
  }
}

export async function diagnosePasswordVerification(env: Env, password: string) {
  try {
    const derivedBytes = await derivePasswordBytes(env, password);

    return {
      deriveSucceeded: true,
      derivedByteLength: derivedBytes.byteLength,
      derivedFingerprint: await fingerprintBytes(derivedBytes),
      errorName: null
    };
  } catch (error) {
    return {
      deriveSucceeded: false,
      derivedByteLength: null,
      derivedFingerprint: null,
      errorName: error instanceof Error ? error.name : "UnknownError"
    };
  }
}

export async function createSessionCookie(env: Env) {
  const timeoutMinutes = Number(env.SESSION_TIMEOUT_MINUTES);
  const session: AuthSession = {
    username: env.AUTH_USERNAME,
    expiresAt: Date.now() + timeoutMinutes * 60_000
  };
  const payload = base64UrlEncode(JSON.stringify(session));
  const signature = await signValue(env.SESSION_SECRET, payload);

  return {
    session,
    cookie: `${sessionCookieName}=${payload}.${signature}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${
      timeoutMinutes * 60
    }`
  };
}

export function clearSessionCookie() {
  return `${sessionCookieName}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export async function readSession(request: Request, env: Env) {
  if (!validateAuthConfig(env)) {
    return null;
  }

  const cookie = request.headers.get("Cookie") ?? "";
  const rawValue = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`))
    ?.slice(sessionCookieName.length + 1);

  if (!rawValue) {
    return null;
  }

  const [payload, signature] = rawValue.split(".");

  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = await signValue(env.SESSION_SECRET, payload);

  if (!constantTimeStringEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const session = JSON.parse(base64UrlDecode(payload)) as AuthSession;

    if (
      typeof session.username !== "string" ||
      typeof session.expiresAt !== "number" ||
      session.expiresAt <= Date.now()
    ) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export async function requireSession(request: Request, env: Env) {
  const session = await readSession(request, env);

  if (session === null) {
    return {
      ok: false as const,
      response: jsonResponse({ error: "Unauthorized." }, { status: 401 })
    };
  }

  return { ok: true as const, session };
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function readBase64Bytes(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    return base64ToBytes(value);
  } catch {
    return null;
  }
}

async function derivePasswordBytes(env: Env, password: string) {
  const algorithm = getPasswordAlgorithm(env);

  if (algorithm === "sha256") {
    return deriveSaltedSha256Bytes(env, password);
  }

  if (algorithm === "pbkdf2") {
    return derivePbkdf2Bytes(env, password);
  }

  throw new Error("Unsupported password algorithm.");
}

async function deriveSaltedSha256Bytes(env: Env, password: string) {
  const salt = base64ToBytes(env.AUTH_PASSWORD_SALT);
  const passwordBytes = new TextEncoder().encode(password);
  const input = new Uint8Array(salt.byteLength + passwordBytes.byteLength);

  input.set(salt);
  input.set(passwordBytes, salt.byteLength);

  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(input));

  return new Uint8Array(digest);
}

async function derivePbkdf2Bytes(env: Env, password: string) {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: toArrayBuffer(base64ToBytes(env.AUTH_PASSWORD_SALT)),
      iterations: Number(env.AUTH_PASSWORD_ITERATIONS)
    },
    passwordKey,
    256
  );

  return new Uint8Array(bits);
}

function getPasswordAlgorithm(env: Env) {
  const algorithm = env.AUTH_PASSWORD_ALGORITHM ?? "sha256";

  return algorithm === "sha256" || algorithm === "pbkdf2" ? algorithm : null;
}

async function fingerprintBytes(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(bytes));

  return Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function toArrayBuffer(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);

  return copy.buffer;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function base64UrlEncode(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlDecode(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "="
  );

  return new TextDecoder().decode(base64ToBytes(padded));
}

async function signValue(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );

  return bytesToBase64Url(new Uint8Array(signature));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }

  return difference === 0;
}

function constantTimeStringEqual(left: string, right: string) {
  return constantTimeEqual(
    new TextEncoder().encode(left),
    new TextEncoder().encode(right)
  );
}
