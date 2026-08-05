import { requireSession } from "../../_shared/auth";
import { jsonResponse, methodNotAllowed, readJson } from "../../_shared/http";
import { createDailyBackup } from "../../_shared/transactions";
import type { PagesContext } from "../../_shared/types";

export async function onRequestPost({ request, env }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  const body = (await readJson(request)) as { backupDate?: unknown };

  if (typeof body.backupDate !== "string" || body.backupDate.length === 0) {
    return jsonResponse({ error: "Invalid backup date." }, { status: 400 });
  }

  const result = await createDailyBackup(env.DB, body.backupDate, auth.session);

  return jsonResponse(result);
}

export function onRequest() {
  return methodNotAllowed();
}
