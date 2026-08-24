import { requireSession } from "../../_shared/auth";
import {
  forbidden,
  isForbiddenError,
  jsonResponse,
  methodNotAllowed,
  readJson
} from "../../_shared/http";
import { createClient, listClients, readClientInput } from "../../_shared/clients";
import type { PagesContext } from "../../_shared/types";

export async function onRequestGet({ request, env }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  return jsonResponse({ clients: await listClients(env.DB, auth.session) });
}

export async function onRequestPost({ request, env }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  const input = readClientInput(await readJson(request));

  if (input === null) {
    return jsonResponse({ error: "Invalid client." }, { status: 400 });
  }

  try {
    return jsonResponse(
      { client: await createClient(env.DB, input, auth.session) },
      { status: 201 }
    );
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

export function onRequest() {
  return methodNotAllowed();
}
