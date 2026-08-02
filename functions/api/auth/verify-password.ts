import { requireSession, verifyPassword } from "../../_shared/auth";
import { jsonResponse, methodNotAllowed, readJson } from "../../_shared/http";
import type { PagesContext } from "../../_shared/types";

export async function onRequestPost({ request, env }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  const body = await readJson(request);

  if (
    typeof body !== "object" ||
    body === null ||
    !("password" in body) ||
    typeof body.password !== "string"
  ) {
    return jsonResponse({ error: "Invalid credentials." }, { status: 401 });
  }

  if (!(await verifyPassword(env, body.password))) {
    return jsonResponse({ error: "Invalid credentials." }, { status: 401 });
  }

  return jsonResponse({ ok: true });
}

export function onRequest() {
  return methodNotAllowed();
}
