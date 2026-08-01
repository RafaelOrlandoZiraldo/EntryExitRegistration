import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type {
  AuthConfig,
  AuthSession,
  PasswordVerifier,
  SessionService
} from "@application/auth";
import {
  AuthenticationConfigurationError,
  InvalidCredentialsError
} from "@application/auth";
import { AuthProvider } from "./AuthContext";
import { LoginPage } from "./LoginPage";

const config: AuthConfig = {
  username: "admin",
  passwordHash: "hash",
  passwordSalt: "salt",
  passwordIterations: 1000,
  sessionTimeoutMinutes: 30
};

class FakePasswordVerifier implements PasswordVerifier {
  constructor(private readonly validPassword: string) {}

  verify(input: Parameters<PasswordVerifier["verify"]>[0]) {
    return Promise.resolve(input.password === this.validPassword);
  }
}

class MemorySessionService implements SessionService {
  public session: AuthSession | null = null;

  create(username: string, timeoutMinutes: number) {
    this.session = {
      username,
      expiresAt: timeoutMinutes
    };
    return this.session;
  }

  getCurrent() {
    return this.session;
  }

  touch() {
    return this.session;
  }

  clear() {
    this.session = null;
  }
}

describe("LoginPage", () => {
  it("LoginPage_WhenCredentialsAreValid_ShouldNavigateToRedirect", async () => {
    const user = userEvent.setup();
    renderLoginPage({
      verifier: new FakePasswordVerifier("correct-password"),
      initialEntry: "/login?redirectTo=/"
    });

    await user.type(screen.getByLabelText(/usuario/i), "admin");
    await user.type(screen.getByLabelText(/contrasena/i), "correct-password");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    expect(await screen.findByText("Ruta privada")).toBeInTheDocument();
  });

  it("LoginPage_WhenCredentialsAreInvalid_ShouldShowGenericErrorAndClearPassword", async () => {
    const user = userEvent.setup();
    renderLoginPage({
      verifier: new FakePasswordVerifier("correct-password")
    });
    const passwordInput = screen.getByLabelText(/contrasena/i);

    await user.type(screen.getByLabelText(/usuario/i), "admin");
    await user.type(passwordInput, "wrong-password");
    await user.click(screen.getByRole("button", { name: /ingresar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Usuario o contrasena invalidos."
    );
    expect(passwordInput).toHaveValue("");
  });

  it("LoginPage_WhenConfigurationIsMissing_ShouldFailClosed", () => {
    renderLoginPage({
      configOverride: null,
      verifier: new FakePasswordVerifier("correct-password")
    });

    expect(
      screen.getByText("La configuracion de autenticacion no es valida.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ingresar/i })).toBeDisabled();
  });
});

function renderLoginPage({
  configOverride = config,
  verifier,
  initialEntry = "/login"
}: {
  configOverride?: AuthConfig | null;
  verifier: PasswordVerifier;
  initialEntry?: string;
}) {
  render(
    <AuthProvider
      dependencies={{
        config: configOverride,
        passwordVerifier: verifier,
        sessionService: new MemorySessionService()
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
