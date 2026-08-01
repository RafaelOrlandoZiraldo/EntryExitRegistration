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
