import {
  AuthenticationConfigurationError,
  InvalidCredentialsError
} from "./errors";
import type { PasswordVerifier, SessionService } from "./ports";
import type { AuthConfig } from "./types";

export interface LoginInput {
  username: string;
  password: string;
}

export interface LoginUseCaseDependencies {
  config: AuthConfig | null;
  passwordVerifier: PasswordVerifier;
  sessionService: SessionService;
}

export class LoginUseCase {
  constructor(private readonly dependencies: LoginUseCaseDependencies) {}

  async execute(input: LoginInput) {
    const config = this.dependencies.config;

    if (config === null) {
      throw new AuthenticationConfigurationError();
    }

    const passwordMatches = await this.dependencies.passwordVerifier.verify({
      password: input.password,
      passwordHash: config.passwordHash,
      passwordSalt: config.passwordSalt,
      passwordIterations: config.passwordIterations
    });

    if (input.username !== config.username || !passwordMatches) {
      throw new InvalidCredentialsError();
    }

    return this.dependencies.sessionService.create(
      config.username,
      config.sessionTimeoutMinutes
    );
  }
}
