import type { PasswordVerifier } from "@application/auth";
import { base64ToBytes } from "./config";

export class WebCryptoPasswordVerifier implements PasswordVerifier {
  async verify(input: Parameters<PasswordVerifier["verify"]>[0]) {
    const passwordKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(input.password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: base64ToBytes(input.passwordSalt),
        iterations: input.passwordIterations
      },
      passwordKey,
      256
    );

    return constantTimeEqual(
      new Uint8Array(derivedBits),
      base64ToBytes(input.passwordHash)
    );
  }
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }

  return difference === 0;
}
