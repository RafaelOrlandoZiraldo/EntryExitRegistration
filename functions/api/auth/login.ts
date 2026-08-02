import {
  createSessionCookie,
  validateAuthConfig,
  verifyPassword
} from "../../_shared/auth";
import { jsonResponse, methodNotAllowed, readJson } from "../../_shared/http";
import type { PagesContext } from "../../_shared/types";

export async function onRequestPost({ request, env }: PagesContext) {
  if (!validateAuthConfig(env)) {
    return jsonResponse({ error: "Authentication is not configured." }, { status: 500 });
  }

  const body = await readJson(request);

  if (
    typeof body !== "object" ||
    body === null ||
    !("username" in body) ||
    !("password" in body) ||
    typeof body.username !== "string" ||
    typeof body.password !== "string"
  ) {
    return jsonResponse({ error: "Invalid credentials." }, { status: 401 });
  }

  const passwordMatches = await verifyPassword(env, body.password);

  if (body.username !== env.AUTH_USERNAME || !passwordMatches) {
    return jsonResponse({ error: "Invalid credentials." }, { status: 401 });
  }

  const { session, cookie } = await createSessionCookie(env);

  return jsonResponse(
    { session },
    {
      headers: {
        "Set-Cookie": cookie
      }
    }
  );
}

export function onRequest() {
  return methodNotAllowed();
}
