import { requireSession } from "../../../_shared/auth";
import {
  forbidden,
  isForbiddenError,
  jsonResponse,
  methodNotAllowed,
  readJson
} from "../../../_shared/http";
import { createArticle, readArticleInput } from "../../../_shared/catalog";
import type { PagesContext } from "../../../_shared/types";

export async function onRequestPost({ request, env }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  const input = readArticleInput(await readJson(request));

  if (input === null) {
    return jsonResponse({ error: "Invalid article." }, { status: 400 });
  }

  try {
    return jsonResponse(
      { article: await createArticle(env.DB, input, auth.session) },
      { status: 201 }
    );
  } catch (error) {
    if (isForbiddenError(error)) {
      return forbidden();
    }

    if (error instanceof Error && error.message === "Invalid category.") {
      return jsonResponse({ error: "Invalid category." }, { status: 400 });
    }

    throw error;
  }
}

export function onRequest() {
  return methodNotAllowed();
}
