import { requireSession } from "../../_shared/auth";
import {
  forbidden,
  isForbiddenError,
  jsonResponse,
  methodNotAllowed,
  readJson
} from "../../_shared/http";
import {
  deleteSupplier,
  readSupplierInput,
  updateSupplier
} from "../../_shared/suppliers";
import type { PagesContext } from "../../_shared/types";

export async function onRequestPut({ request, env, params }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  const id = readId(params);
  const input = readSupplierInput(await readJson(request));

  if (id === null || input === null) {
    return jsonResponse({ error: "Invalid supplier." }, { status: 400 });
  }

  try {
    return jsonResponse({
      supplier: await updateSupplier(env.DB, id, input, auth.session)
    });
  } catch (error) {
    if (isForbiddenError(error)) {
      return forbidden();
    }

    if (error instanceof Error && error.message === "Supplier name exists.") {
      return jsonResponse({ error: "Supplier name exists." }, { status: 409 });
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
    return jsonResponse({ error: "Invalid supplier id." }, { status: 400 });
  }

  try {
    await deleteSupplier(env.DB, id, auth.session);
  } catch (error) {
    if (isForbiddenError(error)) {
      return forbidden();
    }

    if (
      error instanceof Error &&
      error.message === "Supplier has purchase orders."
    ) {
      return jsonResponse(
        { error: "Supplier has purchase orders." },
        { status: 409 }
      );
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
