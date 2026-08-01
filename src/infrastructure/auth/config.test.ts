import { describe, expect, it } from "vitest";
import { parseAuthConfig } from "./config";

const validEnv = {
  VITE_AUTH_USERNAME: "admin",
  VITE_AUTH_PASSWORD_HASH: "AfGR8Ah/emGOMpAR6YIWpVn013Z7Wo0hhWMZeFFcMv0=",
  VITE_AUTH_PASSWORD_SALT: "c2FsdC0xMjM0NTY3OA==",
  VITE_AUTH_PASSWORD_ITERATIONS: "1000",
  VITE_SESSION_TIMEOUT_MINUTES: "30"
};

describe("parseAuthConfig", () => {
  it("parseAuthConfig_WhenEnvironmentIsValid_ShouldReturnConfig", () => {
    expect(parseAuthConfig(validEnv)).toEqual({
      username: "admin",
      passwordHash: "AfGR8Ah/emGOMpAR6YIWpVn013Z7Wo0hhWMZeFFcMv0=",
      passwordSalt: "c2FsdC0xMjM0NTY3OA==",
      passwordIterations: 1000,
      sessionTimeoutMinutes: 30
    });
  });

  it("parseAuthConfig_WhenConfigurationIsMissing_ShouldFailClosed", () => {
    expect(
      parseAuthConfig({
        ...validEnv,
        VITE_AUTH_PASSWORD_HASH: ""
      })
    ).toBeNull();
  });

  it("parseAuthConfig_WhenBase64IsInvalid_ShouldFailClosed", () => {
    expect(
      parseAuthConfig({
        ...validEnv,
        VITE_AUTH_PASSWORD_SALT: "not base64"
      })
    ).toBeNull();
  });
});
