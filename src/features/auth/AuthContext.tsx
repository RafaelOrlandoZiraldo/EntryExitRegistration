import React from "react";
import type { AuthClient, AuthSession } from "@application/auth";
import { LoadingState } from "@shared/ui";

interface AuthContextValue {
  session: AuthSession | null;
  isAuthenticated: boolean;
  isConfigurationValid: boolean;
  isInitializing: boolean;
  login(input: { username: string; password: string }): Promise<void>;
  logout(): Promise<void>;
  refreshSession(): Promise<void>;
}

interface AuthProviderDependencies {
  authClient: AuthClient;
  isConfigurationValid: boolean;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  children: React.ReactNode;
  dependencies: AuthProviderDependencies;
}

export function AuthProvider({ children, dependencies }: AuthProviderProps) {
  const authDependencies = React.useMemo(() => dependencies, [dependencies]);
  const [session, setSession] = React.useState<AuthSession | null>(null);
  const [isInitializing, setIsInitializing] = React.useState(true);
  const [isConfigurationValid, setIsConfigurationValid] = React.useState(
    authDependencies.isConfigurationValid
  );

  React.useEffect(() => {
    let isMounted = true;

    authDependencies.authClient
      .getCurrent()
      .then((nextSession) => {
        if (isMounted) {
          setSession(nextSession);
          setIsConfigurationValid(authDependencies.isConfigurationValid);
        }
      })
      .catch(() => {
        if (isMounted) {
          setSession(null);
          setIsConfigurationValid(false);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsInitializing(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [authDependencies]);

  const refreshSession = React.useCallback(async () => {
    const nextSession = await authDependencies.authClient.refreshSession();
    setSession(nextSession);
  }, [authDependencies]);

  React.useEffect(() => {
    if (session === null || !isConfigurationValid) {
      return undefined;
    }

    const checkSession = () => {
      void authDependencies.authClient.getCurrent().then(setSession);
    };
    const refreshOnActivity = () => {
      void refreshSession();
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
  }, [authDependencies, isConfigurationValid, refreshSession, session]);

  const login = React.useCallback(
    async (input: { username: string; password: string }) => {
      const nextSession = await authDependencies.authClient.login(input);

      setIsConfigurationValid(true);
      setSession(nextSession);
    },
    [authDependencies]
  );

  const logout = React.useCallback(async () => {
    await authDependencies.authClient.logout();
    setSession(null);
  }, [authDependencies]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: session !== null,
      isConfigurationValid,
      isInitializing,
      login,
      logout,
      refreshSession
    }),
    [isConfigurationValid, isInitializing, login, logout, refreshSession, session]
  );

  if (isInitializing) {
    return <LoadingState label="Validando sesion..." />;
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = React.useContext(AuthContext);

  if (context === null) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
