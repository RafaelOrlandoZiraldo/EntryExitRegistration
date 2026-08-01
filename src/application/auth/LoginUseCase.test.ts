import { describe, expect, it } from "vitest";
import {
  AuthenticationConfigurationError,
  InvalidCredentialsError,
  LoginUseCase,
  type AuthConfig,
  type AuthSession,
  type PasswordVerifier,
  type SessionService
} from "./index";

const config: AuthConfig = {
  username: "admin",
  passwordHash: "hash",
  passwordSalt: "salt",
  passwordIterations: 1000,
  sessionTimeoutMinutes: 30
};

class FakePasswordVerifier implements PasswordVerifier {
  constructor(private readonly result: boolean) {}

  verify() {
    return Promise.resolve(this.result);
  }
}

class FakeSessionService implements SessionService {
  public session: AuthSession | null = null;

  create(username: string, timeoutMinutes: number) {
    this.session = {
      username,
      expiresAt: timeoutMinutes
    };
    return this.session;
  }

  getCurrent() {
    return this.session;
  }

  touch() {
    return this.session;
  }

  clear() {
    this.session = null;
  }
}

describe("LoginUseCase", () => {
  it("execute_WhenCredentialsAreValid_ShouldCreateSession", async () => {
    const sessionService = new FakeSessionService();
    const useCase = new LoginUseCase({
      config,
      passwordVerifier: new FakePasswordVerifier(true),
      sessionService
    });

    await expect(
      useCase.execute({ username: "admin", password: "correct-password" })
    ).resolves.toEqual({ username: "admin", expiresAt: 30 });
  });

  it("execute_WhenCredentialsAreInvalid_ShouldRejectWithoutSession", async () => {
    const sessionService = new FakeSessionService();
    const useCase = new LoginUseCase({
      config,
      passwordVerifier: new FakePasswordVerifier(false),
      sessionService
    });

    await expect(
      useCase.execute({ username: "admin", password: "wrong-password" })
    ).rejects.toThrow(InvalidCredentialsError);
    expect(sessionService.getCurrent()).toBeNull();
  });

  it("execute_WhenConfigurationIsMissing_ShouldFailClosed", async () => {
    const useCase = new LoginUseCase({
      config: null,
      passwordVerifier: new FakePasswordVerifier(true),
      sessionService: new FakeSessionService()
    });

    await expect(
      useCase.execute({ username: "admin", password: "correct-password" })
    ).rejects.toThrow(AuthenticationConfigurationError);
  });
});
