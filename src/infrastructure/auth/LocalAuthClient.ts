import {
  AuthenticationConfigurationError,
  LoginUseCase,
  VerifyPasswordUseCase,
  type AuthClient,
  type AuthConfig,
  type AuthSession,
  type PasswordVerifier,
  type SessionService
} from "@application/auth";

export interface LocalAuthClientDependencies {
  config: AuthConfig | null;
  passwordVerifier: PasswordVerifier;
  sessionService: SessionService;
}

export class LocalAuthClient implements AuthClient {
  constructor(private readonly dependencies: LocalAuthClientDependencies) {}

  getCurrent(): Promise<AuthSession | null> {
    if (this.dependencies.config === null) {
      return Promise.reject(new AuthenticationConfigurationError());
    }

    return Promise.resolve(this.dependencies.sessionService.getCurrent());
  }

  async login(input: {
    username: string;
    password: string;
  }): Promise<AuthSession> {
    if (this.dependencies.config === null) {
      throw new AuthenticationConfigurationError();
    }

    return new LoginUseCase(this.dependencies).execute(input);
  }

  logout(): Promise<void> {
    this.dependencies.sessionService.clear();

    return Promise.resolve();
  }

  refreshSession(): Promise<AuthSession | null> {
    const config = this.dependencies.config;

    if (config === null) {
      return Promise.reject(new AuthenticationConfigurationError());
    }

    return Promise.resolve(
      this.dependencies.sessionService.touch(config.sessionTimeoutMinutes)
    );
  }

  async verifyPassword(password: string): Promise<void> {
    if (this.dependencies.config === null) {
      throw new AuthenticationConfigurationError();
    }

    await new VerifyPasswordUseCase({
      config: this.dependencies.config,
      passwordVerifier: this.dependencies.passwordVerifier
    }).execute(password);
  }
}
