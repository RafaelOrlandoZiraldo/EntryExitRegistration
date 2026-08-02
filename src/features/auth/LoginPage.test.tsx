import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { AuthClient, AuthSession } from "@application/auth";
import {
  AuthenticationConfigurationError,
  InvalidCredentialsError
} from "@application/auth";
import { AuthProvider } from "./AuthContext";
import { LoginPage } from "./LoginPage";

class FakeAuthClient implements AuthClient {
  public session: AuthSession | null = null;

  constructor(
    private readonly validPassword: string,
    private readonly configurationValid = true
  ) {}

  getCurrent(): Promise<AuthSession | null> {
    if (!this.configurationValid) {
      return Promise.reject(new AuthenticationConfigurationError());
    }

    return Promise.resolve(this.session);
  }

  login(input: {
    username: string;
    password: string;
  }): Promise<AuthSession> {
    if (!this.configurationValid) {
      return Promise.reject(new AuthenticationConfigurationError());
    }

    if (input.username !== "admin" || input.password !== this.validPassword) {
      return Promise.reject(new InvalidCredentialsError());
    }

    this.session = {
      username: input.username,
      expiresAt: Date.now() + 30 * 60_000
    };

    return Promise.resolve(this.session);
  }

  logout(): Promise<void> {
    this.session = null;

    return Promise.resolve();
  }

  refreshSession(): Promise<AuthSession | null> {
    return Promise.resolve(this.session);
  }

  verifyPassword(password: string): Promise<void> {
    return password === this.validPassword
      ? Promise.resolve()
      : Promise.reject(new InvalidCredentialsError());
  }
}

describe("LoginPage", () => {
  it("LoginPage_WhenCredentialsAreValid_ShouldNavigateToRedirect", async () => {
    const user = userEvent.setup();
    renderLoginPage({
      authClient: new FakeAuthClient("correct-password"),
      initialEntry: "/login?redirectTo=/"
    });

    await screen.findByRole("button", { name: /ingresar/i });
    await user.type(screen.getByLabelText(/usuario/i), "admin");
    await user.type(screen.getByLabelText(/contrasena/i), "correct-password");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    expect(await screen.findByText("Ruta privada")).toBeInTheDocument();
  });

  it("LoginPage_WhenCredentialsAreInvalid_ShouldShowGenericErrorAndClearPassword", async () => {
    const user = userEvent.setup();
    renderLoginPage({
      authClient: new FakeAuthClient("correct-password")
    });
    const passwordInput = await screen.findByLabelText(/contrasena/i);

    await user.type(screen.getByLabelText(/usuario/i), "admin");
    await user.type(passwordInput, "wrong-password");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Usuario o contrasena invalidos."
    );
    expect(passwordInput).toHaveValue("");
  });

  it("LoginPage_WhenConfigurationIsMissing_ShouldFailClosed", async () => {
    renderLoginPage({
      authClient: new FakeAuthClient("correct-password", false),
      isConfigurationValid: false
    });

    expect(
      await screen.findByText("La configuracion de autenticacion no es valida.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ingresar/i })).toBeDisabled();
  });
});

function renderLoginPage({
  authClient,
  isConfigurationValid = true,
  initialEntry = "/login"
}: {
  authClient: AuthClient;
  isConfigurationValid?: boolean;
  initialEntry?: string;
}) {
  render(
    <AuthProvider
      dependencies={{
        authClient,
        isConfigurationValid
      }}
    >
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<LoginPage mapError={mapAuthError} />} />
          <Route path="/" element={<p>Ruta privada</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

function mapAuthError(error: unknown) {
  if (error instanceof InvalidCredentialsError) {
    return { message: "Usuario o contrasena invalidos." };
  }

  if (error instanceof AuthenticationConfigurationError) {
    return {
      message: "La configuracion de autenticacion no es valida."
    };
  }

  return { message: "No se pudo completar la operacion." };
}
