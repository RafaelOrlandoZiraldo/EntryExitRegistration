import { requireSession } from "../../../_shared/auth";
import {
  forbidden,
  isForbiddenError,
  jsonResponse,
  methodNotAllowed,
  readJson
} from "../../../_shared/http";
import { createCategory, readCategoryInput } from "../../../_shared/catalog";
import type { PagesContext } from "../../../_shared/types";

export async function onRequestPost({ request, env }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  const input = readCategoryInput(await readJson(request));

  if (input === null) {
    return jsonResponse({ error: "Invalid category." }, { status: 400 });
  }

  try {
    return jsonResponse(
      { category: await createCategory(env.DB, input, auth.session) },
      { status: 201 }
    );
  } catch (error) {
    if (isForbiddenError(error)) {
      return forbidden();
    }

    throw error;
  }
}

export function onRequest() {
  return methodNotAllowed();
}
