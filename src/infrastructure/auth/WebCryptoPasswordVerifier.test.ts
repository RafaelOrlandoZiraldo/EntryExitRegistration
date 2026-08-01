import { describe, expect, it } from "vitest";
import { WebCryptoPasswordVerifier } from "./WebCryptoPasswordVerifier";

describe("WebCryptoPasswordVerifier", () => {
  it("verify_WhenPasswordMatchesVector_ShouldReturnTrue", async () => {
    const verifier = new WebCryptoPasswordVerifier();

    await expect(
      verifier.verify({
        password: "correct-password",
        passwordHash: "AfGR8Ah/emGOMpAR6YIWpVn013Z7Wo0hhWMZeFFcMv0=",
        passwordSalt: "c2FsdC0xMjM0NTY3OA==",
        passwordIterations: 1000
      })
    ).resolves.toBe(true);
  });

  it("verify_WhenPasswordDoesNotMatchVector_ShouldReturnFalse", async () => {
    const verifier = new WebCryptoPasswordVerifier();

    await expect(
      verifier.verify({
        password: "wrong-password",
        passwordHash: "AfGR8Ah/emGOMpAR6YIWpVn013Z7Wo0hhWMZeFFcMv0=",
        passwordSalt: "c2FsdC0xMjM0NTY3OA==",
        passwordIterations: 1000
      })
    ).resolves.toBe(false);
  });
});
