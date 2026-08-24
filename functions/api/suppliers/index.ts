import { requireSession } from "../../_shared/auth";
import {
  forbidden,
  isForbiddenError,
  jsonResponse,
  methodNotAllowed,
  readJson
} from "../../_shared/http";
import {
  createSupplier,
  listSuppliers,
  readSupplierInput
} from "../../_shared/suppliers";
import type { PagesContext } from "../../_shared/types";

export async function onRequestGet({ request, env }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  return jsonResponse({ suppliers: await listSuppliers(env.DB, auth.session) });
}

export async function onRequestPost({ request, env }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  const input = readSupplierInput(await readJson(request));

  if (input === null) {
    return jsonResponse({ error: "Invalid supplier." }, { status: 400 });
  }

  try {
    return jsonResponse(
      { supplier: await createSupplier(env.DB, input, auth.session) },
      { status: 201 }
    );
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

export function onRequest() {
  return methodNotAllowed();
}
