import { verifyPassword } from "../../_shared/auth";
import { jsonResponse, readJson } from "../../_shared/http";
import type { Env, PagesContext } from "../../_shared/types";

interface DiagnosticsEnv extends Env {
  DIAGNOSTICS_TOKEN?: string;
}

export async function onRequestGet({ request, env }: PagesContext) {
  const diagnosticsEnv = env as DiagnosticsEnv;

  if (!diagnosticsEnv.DIAGNOSTICS_TOKEN) {
    return jsonResponse({ error: "Not found." }, { status: 404 });
  }

  if (
    request.headers.get("x-diagnostics-token") !==
    diagnosticsEnv.DIAGNOSTICS_TOKEN
  ) {
    return jsonResponse({ error: "Unauthorized." }, { status: 401 });
  }

  const hashBytes = readBase64Bytes(diagnosticsEnv.AUTH_PASSWORD_HASH);
  const saltBytes = readBase64Bytes(diagnosticsEnv.AUTH_PASSWORD_SALT);
  const iterations = Number(diagnosticsEnv.AUTH_PASSWORD_ITERATIONS);
  const timeoutMinutes = Number(diagnosticsEnv.SESSION_TIMEOUT_MINUTES);

  return jsonResponse({
    authUsernameConfigured: Boolean(diagnosticsEnv.AUTH_USERNAME),
    authUsernameLength: diagnosticsEnv.AUTH_USERNAME?.length ?? 0,
    passwordHashConfigured: Boolean(diagnosticsEnv.AUTH_PASSWORD_HASH),
    passwordHashLength: diagnosticsEnv.AUTH_PASSWORD_HASH?.length ?? 0,
    passwordHashByteLength: hashBytes?.byteLength ?? null,
    passwordHashFingerprint: await fingerprint(
      diagnosticsEnv.AUTH_PASSWORD_HASH
    ),
    passwordSaltConfigured: Boolean(diagnosticsEnv.AUTH_PASSWORD_SALT),
    passwordSaltLength: diagnosticsEnv.AUTH_PASSWORD_SALT?.length ?? 0,
    passwordSaltByteLength: saltBytes?.byteLength ?? null,
    passwordSaltFingerprint: await fingerprint(
      diagnosticsEnv.AUTH_PASSWORD_SALT
    ),
    passwordIterations: Number.isFinite(iterations) ? iterations : null,
    sessionTimeoutMinutes: Number.isFinite(timeoutMinutes)
      ? timeoutMinutes
      : null,
    sessionSecretConfigured: Boolean(diagnosticsEnv.SESSION_SECRET),
    sessionSecretLength: diagnosticsEnv.SESSION_SECRET?.length ?? 0,
    configurationValid:
      Boolean(diagnosticsEnv.AUTH_USERNAME) &&
      hashBytes !== null &&
      hashBytes.byteLength === 32 &&
      saltBytes !== null &&
      saltBytes.byteLength > 0 &&
      Number.isInteger(iterations) &&
      iterations > 0 &&
      Number.isInteger(timeoutMinutes) &&
      timeoutMinutes > 0 &&
      Boolean(diagnosticsEnv.SESSION_SECRET)
  });
}

export async function onRequestPost({ request, env }: PagesContext) {
  const diagnosticsEnv = env as DiagnosticsEnv;

  if (!diagnosticsEnv.DIAGNOSTICS_TOKEN) {
    return jsonResponse({ error: "Not found." }, { status: 404 });
  }

  if (
    request.headers.get("x-diagnostics-token") !==
    diagnosticsEnv.DIAGNOSTICS_TOKEN
  ) {
    return jsonResponse({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await readJson(request);

  if (
    typeof body !== "object" ||
    body === null ||
    !("password" in body) ||
    typeof body.password !== "string"
  ) {
    return jsonResponse({ error: "Invalid request." }, { status: 400 });
  }

  return jsonResponse({
    passwordLength: body.password.length,
    passwordMatches: await verifyPassword(diagnosticsEnv, body.password)
  });
}

function readBase64Bytes(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  } catch {
    return null;
  }
}

async function fingerprint(value: string | undefined) {
  if (!value) {
    return null;
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );

  return Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
