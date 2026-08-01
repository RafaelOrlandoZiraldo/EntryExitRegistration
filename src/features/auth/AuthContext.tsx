import React from "react";
import {
  AuthenticationConfigurationError,
  LoginUseCase,
  type AuthConfig,
  type AuthSession,
  type PasswordVerifier,
  type SessionService
} from "@application/auth";

interface AuthContextValue {
  session: AuthSession | null;
  isAuthenticated: boolean;
  isConfigurationValid: boolean;
  login(input: { username: string; password: string }): Promise<void>;
  logout(): void;
  refreshSession(): void;
}

interface AuthProviderDependencies {
  config: AuthConfig | null;
  passwordVerifier: PasswordVerifier;
  sessionService: SessionService;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: React.ReactNode;
  dependencies: AuthProviderDependencies;
}

export function AuthProvider({ children, dependencies }: AuthProviderProps) {
  const authDependencies = React.useMemo(() => dependencies, [dependencies]);
  const [session, setSession] = React.useState<AuthSession | null>(() =>
    authDependencies.config === null
      ? null
      : authDependencies.sessionService.getCurrent()
  );
  const isConfigurationValid = authDependencies.config !== null;

  const refreshSession = React.useCallback(() => {
    const config = authDependencies.config;

    if (config === null) {
      setSession(null);
      return;
    }

    setSession(
      authDependencies.sessionService.touch(config.sessionTimeoutMinutes)
    );
  }, [authDependencies]);

  React.useEffect(() => {
    if (session === null || authDependencies.config === null) {
      return undefined;
    }

    const checkSession = () => {
      setSession(authDependencies.sessionService.getCurrent());
    };
    const refreshOnActivity = () => {
      refreshSession();
    };
    const intervalId = window.setInterval(checkSession, 5_000);

    window.addEventListener("pointerdown", refreshOnActivity);
    window.addEventListener("keydown", refreshOnActivity);
    window.addEventListener("focus", refreshOnActivity);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("pointerdown", refreshOnActivity);
      window.removeEventListener("keydown", refreshOnActivity);
      window.removeEventListener("focus", refreshOnActivity);
    };
  }, [authDependencies, refreshSession, session]);

  const login = React.useCallback(
    async (input: { username: string; password: string }) => {
      if (authDependencies.config === null) {
        throw new AuthenticationConfigurationError();
      }

      const useCase = new LoginUseCase(authDependencies);
      const nextSession = await useCase.execute(input);

      setSession(nextSession);
    },
    [authDependencies]
  );

  const logout = React.useCallback(() => {
    authDependencies.sessionService.clear();
    setSession(null);
  }, [authDependencies]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: session !== null,
      isConfigurationValid,
      login,
      logout,
      refreshSession
    }),
    [isConfigurationValid, login, logout, refreshSession, session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);

  if (context === null) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
