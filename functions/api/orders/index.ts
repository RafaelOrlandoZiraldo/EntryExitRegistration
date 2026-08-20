import { requireSession } from "../../_shared/auth";
import {
  forbidden,
  isForbiddenError,
  jsonResponse,
  methodNotAllowed,
  readJson
} from "../../_shared/http";
import { createOrder, listOrders, readOrderInput } from "../../_shared/orders";
import type { PagesContext } from "../../_shared/types";

export async function onRequestGet({ request, env }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  return jsonResponse({ orders: await listOrders(env.DB, auth.session) });
}

export async function onRequestPost({ request, env }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  const input = readOrderInput(await readJson(request));

  if (input === null) {
    return jsonResponse({ error: "Invalid order." }, { status: 400 });
  }

  try {
    return jsonResponse(
      { order: await createOrder(env.DB, input, auth.session) },
      { status: 201 }
    );
  } catch (error) {
    if (isForbiddenError(error)) {
      return forbidden();
    }

    if (error instanceof Error && error.message === "Invalid article.") {
      return jsonResponse({ error: "Invalid article." }, { status: 400 });
    }

    if (error instanceof Error && error.message === "Missing price.") {
      return jsonResponse({ error: "Missing price." }, { status: 400 });
    }

    if (error instanceof Error && error.message === "Insufficient stock.") {
      return jsonResponse({ error: "Insufficient stock." }, { status: 400 });
    }

    throw error;
  }
}

export function onRequest() {
  return methodNotAllowed();
}
