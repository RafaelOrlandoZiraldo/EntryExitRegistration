import { requireSession } from "../../_shared/auth";
import {
  forbidden,
  isForbiddenError,
  jsonResponse,
  methodNotAllowed,
  readJson
} from "../../_shared/http";
import {
  createPurchaseOrder,
  listPurchaseOrders,
  readPurchaseOrderInput
} from "../../_shared/purchaseOrders";
import type { PagesContext } from "../../_shared/types";

export async function onRequestGet({ request, env }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  return jsonResponse(await listPurchaseOrders(env.DB, auth.session));
}

export async function onRequestPost({ request, env }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  const input = readPurchaseOrderInput(await readJson(request));

  if (input === null) {
    return jsonResponse({ error: "Invalid purchase order." }, { status: 400 });
  }

  try {
    return jsonResponse(
      { order: await createPurchaseOrder(env.DB, input, auth.session) },
      { status: 201 }
    );
  } catch (error) {
    if (isForbiddenError(error)) {
      return forbidden();
    }

    if (error instanceof Error && error.message === "Invalid article.") {
      return jsonResponse({ error: "Invalid article." }, { status: 400 });
    }

    throw error;
  }
}

export function onRequest() {
  return methodNotAllowed();
}
