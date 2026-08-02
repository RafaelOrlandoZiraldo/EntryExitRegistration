import { clearSessionCookie } from "../../_shared/auth";
import { jsonResponse, methodNotAllowed } from "../../_shared/http";

export function onRequestPost() {
  return jsonResponse(
    { ok: true },
    {
      headers: {
        "Set-Cookie": clearSessionCookie()
      }
    }
  );
}

export function onRequest() {
  return methodNotAllowed();
}
