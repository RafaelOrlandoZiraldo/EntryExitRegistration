import { requireSession } from "../../_shared/auth";
import {
  forbidden,
  isForbiddenError,
  jsonResponse,
  methodNotAllowed,
  readJson
} from "../../_shared/http";
import { deleteClient, readClientInput, updateClient } from "../../_shared/clients";
import type { PagesContext } from "../../_shared/types";

export async function onRequestPut({ request, env, params }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  const id = readId(params);
  const input = readClientInput(await readJson(request));

  if (id === null || input === null) {
    return jsonResponse({ error: "Invalid client." }, { status: 400 });
  }

  try {
    return jsonResponse({
      client: await updateClient(env.DB, id, input, auth.session)
    });
  } catch (error) {
    if (isForbiddenError(error)) {
      return forbidden();
    }

    if (error instanceof Error && error.message === "Client name exists.") {
      return jsonResponse({ error: "Client name exists." }, { status: 409 });
    }

    throw error;
  }
}

export async function onRequestDelete({ request, env, params }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  const id = readId(params);

  if (id === null) {
    return jsonResponse({ error: "Invalid client id." }, { status: 400 });
  }

  try {
    await deleteClient(env.DB, id, auth.session);
  } catch (error) {
    if (isForbiddenError(error)) {
      return forbidden();
    }

    if (error instanceof Error && error.message === "Client has orders.") {
      return jsonResponse({ error: "Client has orders." }, { status: 409 });
    }

    throw error;
  }

  return jsonResponse({ ok: true });
}

export function onRequest() {
  return methodNotAllowed();
}

function readId(params: Record<string, string | string[]>) {
  const id = params.id;

  return typeof id === "string" && id.length > 0 ? id : null;
}
