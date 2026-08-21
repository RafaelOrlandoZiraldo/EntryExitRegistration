import { requireSession } from "../../../_shared/auth";
import {
  forbidden,
  isForbiddenError,
  jsonResponse,
  methodNotAllowed,
  readJson
} from "../../../_shared/http";
import {
  readPurchaseOrderStatus,
  updatePurchaseOrderStatus
} from "../../../_shared/purchaseOrders";
import type { PagesContext } from "../../../_shared/types";

export async function onRequestPatch({ params, request, env }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const body = await readJson(request);
  const status =
    typeof body === "object" && body !== null
      ? readPurchaseOrderStatus((body as { status?: unknown }).status)
      : null;

  if (!id || status === null || status === "draft") {
    return jsonResponse({ error: "Invalid purchase order status." }, { status: 400 });
  }

  try {
    return jsonResponse({
      order: await updatePurchaseOrderStatus(env.DB, id, status, auth.session)
    });
  } catch (error) {
    if (isForbiddenError(error)) {
      return forbidden();
    }

    if (error instanceof Error && error.message === "Not found.") {
      return jsonResponse({ error: "Not found." }, { status: 404 });
    }

    if (error instanceof Error && error.message === "Status is closed.") {
      return jsonResponse({ error: "Status is closed." }, { status: 409 });
    }

    throw error;
  }
}

export function onRequest() {
  return methodNotAllowed();
}
