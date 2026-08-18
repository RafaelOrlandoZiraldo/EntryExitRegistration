import { requireSession } from "../../../_shared/auth";
import {
  forbidden,
  isForbiddenError,
  jsonResponse,
  methodNotAllowed,
  readJson
} from "../../../_shared/http";
import {
  deleteArticle,
  readArticleInput,
  updateArticle
} from "../../../_shared/catalog";
import type { PagesContext } from "../../../_shared/types";

export async function onRequestPut({ request, env, params }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  const id = readId(params);
  const input = readArticleInput(await readJson(request));

  if (id === null || input === null) {
    return jsonResponse({ error: "Invalid article." }, { status: 400 });
  }

  try {
    return jsonResponse({
      article: await updateArticle(env.DB, id, input, auth.session)
    });
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

export async function onRequestDelete({ request, env, params }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  const id = readId(params);

  if (id === null) {
    return jsonResponse({ error: "Invalid article id." }, { status: 400 });
  }

  try {
    await deleteArticle(env.DB, id, auth.session);
  } catch (error) {
    if (isForbiddenError(error)) {
      return forbidden();
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
