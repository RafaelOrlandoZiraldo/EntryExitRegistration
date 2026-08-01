import {
  AuthenticationConfigurationError,
  InvalidCredentialsError
} from "./errors";
import type { PasswordVerifier } from "./ports";
import type { AuthConfig } from "./types";

export interface VerifyPasswordDependencies {
  config: AuthConfig | null;
  passwordVerifier: PasswordVerifier;
}

export class VerifyPasswordUseCase {
  constructor(private readonly dependencies: VerifyPasswordDependencies) {}

  async execute(password: string) {
    const config = this.dependencies.config;

    if (config === null) {
      throw new AuthenticationConfigurationError();
    }

    const passwordMatches = await this.dependencies.passwordVerifier.verify({
      password,
      passwordHash: config.passwordHash,
      passwordSalt: config.passwordSalt,
      passwordIterations: config.passwordIterations
    });

    if (!passwordMatches) {
      throw new InvalidCredentialsError();
    }
  }
}
