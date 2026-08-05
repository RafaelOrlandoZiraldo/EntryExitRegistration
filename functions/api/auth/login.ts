import {
  createSessionCookie,
  validateAuthConfig,
  verifyPasswordConfig
} from "../../_shared/auth";
import { jsonResponse, methodNotAllowed, readJson } from "../../_shared/http";
import type { PagesContext } from "../../_shared/types";
import { ensureBootstrapAdmin, findUserByUsername } from "../../_shared/users";

export async function onRequestPost({ request, env }: PagesContext) {
  if (!validateAuthConfig(env)) {
    return jsonResponse(
      { error: "Authentication is not configured." },
      { status: 500 }
    );
  }

  await ensureBootstrapAdmin(env);
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

  const user = await findUserByUsername(env.DB, body.username);

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

  const { session, cookie } = await createSessionCookie(env, user);

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
