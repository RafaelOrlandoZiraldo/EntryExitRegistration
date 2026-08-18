import { requireSession } from "../../_shared/auth";
import { jsonResponse, methodNotAllowed } from "../../_shared/http";
import { listCatalog } from "../../_shared/catalog";
import type { PagesContext } from "../../_shared/types";

export async function onRequestGet({ request, env }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  return jsonResponse(await listCatalog(env.DB, auth.session));
}

export function onRequest() {
  return methodNotAllowed();
}
