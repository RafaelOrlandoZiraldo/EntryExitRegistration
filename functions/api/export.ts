import { requireSession } from "../_shared/auth";
import { jsonResponse, methodNotAllowed } from "../_shared/http";
import { getDocument } from "../_shared/transactions";
import type { PagesContext } from "../_shared/types";

export async function onRequestGet({ request, env }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  return jsonResponse({ document: await getDocument(env.DB) });
}

export function onRequest() {
  return methodNotAllowed();
}
