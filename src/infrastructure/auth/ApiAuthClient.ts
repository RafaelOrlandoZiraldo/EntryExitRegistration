import {
  AuthenticationConfigurationError,
  InvalidCredentialsError,
  type AuthClient,
  type AuthSession
} from "@application/auth";

interface AuthSessionResponse {
  session: AuthSession | null;
}

export class ApiAuthClient implements AuthClient {
  async getCurrent(): Promise<AuthSession | null> {
    const response = await fetch("/api/auth/session", {
      credentials: "include"
    });

    if (response.status === 401) {
      return null;
    }

    ensureSuccessfulAuthResponse(response);

    return readAuthSessionResponse(response);
  }

  async login(input: {
    username: string;
    password: string;
  }): Promise<AuthSession> {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });

    if (response.status === 401) {
      throw new InvalidCredentialsError();
    }

    ensureSuccessfulAuthResponse(response);

    const session = await readAuthSessionResponse(response);

    if (session === null) {
      throw new AuthenticationConfigurationError();
    }

    return session;
  }

  async logout(): Promise<void> {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include"
    });

    ensureSuccessfulAuthResponse(response);
  }

  async refreshSession(): Promise<AuthSession | null> {
    return this.getCurrent();
  }

  async verifyPassword(password: string): Promise<void> {
    const response = await fetch("/api/auth/verify-password", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ password })
    });

    if (response.status === 401) {
      throw new InvalidCredentialsError();
    }

    ensureSuccessfulAuthResponse(response);
  }
}

function ensureSuccessfulAuthResponse(response: Response) {
  if (response.status === 500 || response.status === 503) {
    throw new AuthenticationConfigurationError();
  }

  if (!response.ok) {
    throw new Error("Authentication request failed.");
  }
}

async function readAuthSessionResponse(response: Response) {
  const body = (await response.json()) as Partial<AuthSessionResponse>;

  return body.session ?? null;
}
