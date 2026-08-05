import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UsersPage } from "./UsersPage";

const authMock = vi.hoisted(() => ({
  role: "admin"
}));

vi.mock("@features/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@features/auth")>();

  return {
    ...actual,
    useAuth: () => ({
      session: {
        userId: "admin-user",
        username: "admin",
        role: authMock.role,
        expiresAt: Date.now() + 60_000
      },
      isAuthenticated: true,
      isConfigurationValid: true,
      isInitializing: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshSession: vi.fn()
    })
  };
});

describe("UsersPage", () => {
  it("UsersPage_WhenAdminCreatesUser_ShouldPersistAndReloadList", async () => {
    const usersService = {
      list: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: "user-1",
            username: "rafa",
            role: "user",
            createdAt: "2026-08-02T10:00:00.000Z"
          }
        ]),
      create: vi.fn().mockResolvedValue({
        id: "user-1",
        username: "rafa",
        role: "user",
        createdAt: "2026-08-02T10:00:00.000Z"
      })
    };
    const user = userEvent.setup();

    render(<UsersPage usersService={usersService} />);

    await user.type(await screen.findByLabelText("Usuario"), "rafa");
    await user.type(screen.getByLabelText("Contraseña"), "password123");
    await user.click(screen.getByRole("button", { name: "Crear" }));

    await waitFor(() => {
      expect(usersService.create).toHaveBeenCalledWith({
        username: "rafa",
        password: "password123",
        role: "user"
      });
    });
    expect(await screen.findByText("Usuario creado correctamente.")).toBeInTheDocument();
    expect(await screen.findByText("rafa")).toBeInTheDocument();
  });

  it("UsersPage_WhenRegularUserOpensPage_ShouldShowRestrictedAccess", () => {
    authMock.role = "user";

    render(
      <UsersPage
        usersService={{
          list: vi.fn(),
          create: vi.fn()
        }}
      />
    );

    expect(screen.getByText("Acceso restringido")).toBeInTheDocument();

    authMock.role = "admin";
  });
});
