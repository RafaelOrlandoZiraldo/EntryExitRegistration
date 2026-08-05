import { requireSession } from "../_shared/auth";
import {
  forbidden,
  isForbiddenError,
  jsonResponse,
  methodNotAllowed,
  readJson
} from "../_shared/http";
import { readDocument, replaceDocument } from "../_shared/transactions";
import type { PagesContext } from "../_shared/types";

export async function onRequestPost({ request, env }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  const body = (await readJson(request)) as { document?: unknown };
  const document = readDocument(body.document);

  if (document === null) {
    return jsonResponse({ error: "Invalid storage document." }, { status: 400 });
  }

  try {
    await replaceDocument(env.DB, document, auth.session);
  } catch (error) {
    if (isForbiddenError(error)) {
      return forbidden();
    }

    throw error;
  }

  return jsonResponse({ document });
}

export function onRequest() {
  return methodNotAllowed();
}
