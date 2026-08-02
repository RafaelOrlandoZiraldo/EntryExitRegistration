import { createSessionCookie, readSession } from "../../_shared/auth";
import { jsonResponse, methodNotAllowed } from "../../_shared/http";
import type { PagesContext } from "../../_shared/types";

export async function onRequestGet({ request, env }: PagesContext) {
  const session = await readSession(request, env);

  if (session === null) {
    return jsonResponse({ session: null }, { status: 401 });
  }

  const refreshed = await createSessionCookie(env);

  return jsonResponse(
    { session: refreshed.session },
    {
      headers: {
        "Set-Cookie": refreshed.cookie
      }
    }
  );
}

export function onRequest() {
  return methodNotAllowed();
}
