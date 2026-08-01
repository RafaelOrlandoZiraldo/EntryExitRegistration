import {
  VerifyPasswordUseCase,
  type AuthConfig,
  type PasswordVerifier,
  type SessionService
} from "@application/auth";
import {
  readAuthConfigFromEnv,
  SessionStorageSessionService,
  SystemEpochClock,
  WebCryptoPasswordVerifier
} from "@infrastructure/auth";
import type { AuthProviderProps } from "@features/auth";

export function createBrowserAuthDependencies(): AuthProviderProps["dependencies"] {
  return {
    config: readAuthConfigFromEnv(),
    passwordVerifier: new WebCryptoPasswordVerifier(),
    sessionService: new SessionStorageSessionService(
      window.sessionStorage,
      new SystemEpochClock()
    )
  };
}

const browserAuthDependencies = createBrowserAuthDependencies();

export const authServices = {
  dependencies: browserAuthDependencies,
  verifyPassword: new VerifyPasswordUseCase({
    config: browserAuthDependencies.config,
    passwordVerifier: browserAuthDependencies.passwordVerifier
  })
};

export type BrowserAuthDependencies = {
  config: AuthConfig | null;
  passwordVerifier: PasswordVerifier;
  sessionService: SessionService;
};
