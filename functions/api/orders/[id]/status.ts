import { requireSession } from "../../../_shared/auth";
import {
  forbidden,
  isForbiddenError,
  jsonResponse,
  methodNotAllowed,
  readJson
} from "../../../_shared/http";
import {
  readOrderStatusInput,
  updateOrderStatus
} from "../../../_shared/orders";
import type { PagesContext } from "../../../_shared/types";

export async function onRequestPut({ request, env, params }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  const id = readId(params);
  const status = readOrderStatusInput(await readJson(request));

  if (id === null || status === null) {
    return jsonResponse({ error: "Invalid order status." }, { status: 400 });
  }

  try {
    return jsonResponse({
      order: await updateOrderStatus(env.DB, id, status, auth.session)
    });
  } catch (error) {
    if (isForbiddenError(error)) {
      return forbidden();
    }

    if (error instanceof Error && error.message === "Not found.") {
      return jsonResponse({ error: "Not found." }, { status: 404 });
    }

    throw error;
  }
}

export function onRequest() {
  return methodNotAllowed();
}

function readId(params: Record<string, string | string[]>) {
  const id = params.id;

  return typeof id === "string" && id.length > 0 ? id : null;
}
