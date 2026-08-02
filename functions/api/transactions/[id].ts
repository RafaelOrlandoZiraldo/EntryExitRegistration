import { requireSession } from "../../_shared/auth";
import { jsonResponse, methodNotAllowed, readJson } from "../../_shared/http";
import {
  deleteTransaction,
  readTransaction,
  updateTransaction
} from "../../_shared/transactions";
import type { PagesContext } from "../../_shared/types";

export async function onRequestPut({ request, env, params }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  const id = readId(params);
  const transaction = readTransaction(await readJson(request));

  if (id === null || transaction === null || transaction.id !== id) {
    return jsonResponse({ error: "Invalid transaction." }, { status: 400 });
  }

  await updateTransaction(env.DB, transaction);

  return jsonResponse({ transaction });
}

export async function onRequestDelete({ request, env, params }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  const id = readId(params);

  if (id === null) {
    return jsonResponse({ error: "Invalid transaction id." }, { status: 400 });
  }

  await deleteTransaction(env.DB, id);

  return jsonResponse({ ok: true });
}

export function onRequest() {
  return methodNotAllowed();
}

function readId(params: Record<string, string | string[]>) {
  const id = params.id;

  return typeof id === "string" && id.length > 0 ? id : null;
}
