import {
  ApiAuthClient,
  LocalAuthClient,
  readAuthConfigFromEnv,
  SessionStorageSessionService,
  SystemEpochClock,
  WebCryptoPasswordVerifier
} from "@infrastructure/auth";
import type { AuthProviderProps } from "@features/auth";

const dataSource = import.meta.env.VITE_DATA_SOURCE;
const useApiBackend = dataSource === "api";

export function createBrowserAuthDependencies(): AuthProviderProps["dependencies"] {
  if (useApiBackend) {
    return {
      authClient: new ApiAuthClient(),
      isConfigurationValid: true
    };
  }

  const config = readAuthConfigFromEnv();
  const authClient = new LocalAuthClient({
    config,
    passwordVerifier: new WebCryptoPasswordVerifier(),
    sessionService: new SessionStorageSessionService(
      window.sessionStorage,
      new SystemEpochClock()
    )
  });

  return {
    authClient,
    isConfigurationValid: config !== null
  };
}

const browserAuthDependencies = createBrowserAuthDependencies();

export const authServices = {
  dependencies: browserAuthDependencies,
  verifyPassword: {
    execute(password: string) {
      return browserAuthDependencies.authClient.verifyPassword(password);
    }
  }
};
