import { requireSession } from "../../_shared/auth";
import { jsonResponse, methodNotAllowed, readJson } from "../../_shared/http";
import type { PagesContext, UserRole } from "../../_shared/types";
import { createUser, listUsers } from "../../_shared/users";

export async function onRequestGet({ request, env }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  if (auth.session.role !== "admin") {
    return jsonResponse({ error: "Forbidden." }, { status: 403 });
  }

  return jsonResponse({
    users: (await listUsers(env.DB)).map((user) => ({
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.createdAt
    }))
  });
}

export async function onRequestPost({ request, env }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  if (auth.session.role !== "admin") {
    return jsonResponse({ error: "Forbidden." }, { status: 403 });
  }

  const body = await readJson(request);

  if (
    typeof body !== "object" ||
    body === null ||
    !("username" in body) ||
    !("password" in body) ||
    !("role" in body) ||
    typeof body.username !== "string" ||
    typeof body.password !== "string" ||
    (body.role !== "admin" && body.role !== "user")
  ) {
    return jsonResponse({ error: "Invalid user." }, { status: 400 });
  }

  const password = await hashPassword(body.password);
  const createdAt = new Date().toISOString();
  const user = {
    id: crypto.randomUUID(),
    username: body.username.trim(),
    role: body.role,
    createdAt,
    ...password
  } satisfies {
    id: string;
    username: string;
    role: UserRole;
    createdAt: string;
    passwordAlgorithm: string;
    passwordHash: string;
    passwordSalt: string;
    passwordIterations: number;
  };

  if (user.username.length === 0 || body.password.length < 8) {
    return jsonResponse({ error: "Invalid user." }, { status: 400 });
  }

  await createUser(env.DB, user);

  return jsonResponse(
    {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.createdAt,
        passwordAlgorithm: user.passwordAlgorithm,
        passwordIterations: user.passwordIterations
      }
    },
    { status: 201 }
  );
}

export function onRequest() {
  return methodNotAllowed();
}

async function hashPassword(password: string) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const passwordBytes = new TextEncoder().encode(password);
  const input = new Uint8Array(salt.byteLength + passwordBytes.byteLength);

  input.set(salt);
  input.set(passwordBytes, salt.byteLength);

  const digest = await crypto.subtle.digest("SHA-256", input);

  return {
    passwordAlgorithm: "sha256",
    passwordHash: bytesToBase64(new Uint8Array(digest)),
    passwordSalt: bytesToBase64(salt),
    passwordIterations: 310000
  };
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}
