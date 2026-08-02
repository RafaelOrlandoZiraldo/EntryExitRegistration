import { requireSession } from "../../_shared/auth";
import { jsonResponse, methodNotAllowed, readJson } from "../../_shared/http";
import {
  createTransaction,
  deleteAllTransactions,
  getTransactions,
  readTransaction
} from "../../_shared/transactions";
import type { PagesContext } from "../../_shared/types";

export async function onRequestGet({ request, env }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  return jsonResponse({ transactions: await getTransactions(env.DB) });
}

export async function onRequestPost({ request, env }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  const transaction = readTransaction(await readJson(request));

  if (transaction === null) {
    return jsonResponse({ error: "Invalid transaction." }, { status: 400 });
  }

  await createTransaction(env.DB, transaction);

  return jsonResponse({ transaction }, { status: 201 });
}

export async function onRequestDelete({ request, env }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  await deleteAllTransactions(env.DB);

  return jsonResponse({ ok: true });
}

export function onRequest() {
  return methodNotAllowed();
}
