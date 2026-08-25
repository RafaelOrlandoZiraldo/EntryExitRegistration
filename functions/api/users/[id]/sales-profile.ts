import { requireSession } from "../../../_shared/auth";
import { jsonResponse, methodNotAllowed, readJson } from "../../../_shared/http";
import {
  assertUserCanOwnSalesCatalog,
  readSalesProfileInput,
  upsertSalesProfile
} from "../../../_shared/salesProfiles";
import type { PagesContext } from "../../../_shared/types";

export async function onRequestPut({ request, env, params }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  if (auth.session.role !== "admin") {
    return jsonResponse({ error: "Forbidden." }, { status: 403 });
  }

  const id = readId(params);
  const input = readSalesProfileInput(await readJson(request));

  if (id === null || input === null) {
    return jsonResponse({ error: "Invalid sales profile." }, { status: 400 });
  }

  const seller = await env.DB.prepare(
    "SELECT id FROM users WHERE id = ? AND role = 'seller'"
  )
    .bind(id)
    .first<{ id: string }>();

  if (!seller) {
    return jsonResponse({ error: "Not found." }, { status: 404 });
  }

  try {
    await assertUserCanOwnSalesCatalog(env.DB, input.catalogUserId);
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid catalog user.") {
      return jsonResponse({ error: "Invalid catalog user." }, { status: 400 });
    }

    throw error;
  }

  return jsonResponse({
    salesProfile: await upsertSalesProfile(env.DB, id, input)
  });
}

export function onRequest() {
  return methodNotAllowed();
}

function readId(params: Record<string, string | string[]>) {
  const id = params.id;

  return typeof id === "string" && id.length > 0 ? id : null;
}
