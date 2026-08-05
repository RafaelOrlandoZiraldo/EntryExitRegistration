import { requireSession, verifyPasswordConfig } from "../../_shared/auth";
import { jsonResponse, methodNotAllowed, readJson } from "../../_shared/http";
import type { PagesContext } from "../../_shared/types";
import { findUserByUsername } from "../../_shared/users";

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

  const user = await findUserByUsername(env.DB, auth.session.username);

  if (
    user === null ||
    !(await verifyPasswordConfig({
      password: body.password,
      passwordAlgorithm: user.passwordAlgorithm,
      passwordHash: user.passwordHash,
      passwordSalt: user.passwordSalt,
      passwordIterations: user.passwordIterations
    }))
  ) {
    return jsonResponse({ error: "Invalid credentials." }, { status: 401 });
  }

  return jsonResponse({ ok: true });
}

export function onRequest() {
  return methodNotAllowed();
}
