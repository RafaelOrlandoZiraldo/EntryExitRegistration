export function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers
    }
  });
}

export function methodNotAllowed() {
  return jsonResponse({ error: "Method not allowed." }, { status: 405 });
}

export function forbidden() {
  return jsonResponse({ error: "Forbidden." }, { status: 403 });
}

export function isForbiddenError(error: unknown) {
  return error instanceof Error && error.message === "Forbidden.";
}

export async function readJson(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}
