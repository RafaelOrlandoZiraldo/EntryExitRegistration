import { UserPlus } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { AppUser, CreateUserInput } from "@app/services/users";
import { useAuth } from "@features/auth";
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageTitle
} from "@shared/ui";

interface UsersPageProps {
  usersService: {
    list(this: void): Promise<AppUser[]>;
    create(this: void, input: CreateUserInput): Promise<AppUser>;
  };
}

type LoadState =
  | { status: "loading" }
  | { status: "success"; users: AppUser[] }
  | { status: "error"; error: string };

export function UsersPage({ usersService }: UsersPageProps) {
  const auth = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [form, setForm] = useState<CreateUserInput>({
    username: "",
    password: "",
    role: "user"
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadUsers = useCallback(() => {
    setState({ status: "loading" });
    void usersService
      .list()
      .then((users) => {
        setState({ status: "success", users });
      })
      .catch(() => {
        setState({
          status: "error",
          error: "No se pudo cargar el listado de usuarios."
        });
      });
  }, [usersService]);

  useEffect(() => {
    if (auth.session?.role === "admin") {
      loadUsers();
    }
  }, [auth.session?.role, loadUsers]);

  if (auth.session?.role !== "admin") {
    return (
      <ErrorState
        title="Acceso restringido"
        message="Solo un administrador puede crear usuarios."
      />
    );
  }

  const submitUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);

    if (form.username.trim().length === 0 || form.password.length < 8) {
      setFeedback(
        "El usuario es obligatorio y la contraseña debe tener al menos 8 caracteres."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      await usersService.create({
        username: form.username.trim(),
        password: form.password,
        role: form.role
      });
      setForm({ username: "", password: "", role: "user" });
      setFeedback("Usuario creado correctamente.");
      loadUsers();
    } catch {
      setFeedback("No se pudo crear el usuario. Revisá que el nombre no exista.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="grid gap-6">
      <PageTitle
        eyebrow="Administracion"
        title="Usuarios"
        description="Crea accesos para que cada usuario gestione sus propios movimientos."
      />

      <form
        className="grid gap-4 rounded-lg border border-border bg-card p-4 shadow-sm md:grid-cols-[1fr_1fr_12rem_auto] md:items-end"
        onSubmit={(event) => void submitUser(event)}
      >
        <label className="grid gap-2 text-sm font-medium">
          Usuario
          <input
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={form.username}
            onChange={(event) => {
              setForm((current) => ({
                ...current,
                username: event.target.value
              }));
            }}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Contraseña
          <input
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            minLength={8}
            type="password"
            value={form.password}
            onChange={(event) => {
              setForm((current) => ({
                ...current,
                password: event.target.value
              }));
            }}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Rol
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={form.role}
            onChange={(event) => {
              setForm((current) => ({
                ...current,
                role: event.target.value === "admin" ? "admin" : "user"
              }));
            }}
          >
            <option value="user">Usuario raso</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <Button disabled={isSubmitting} type="submit">
          <UserPlus aria-hidden="true" className="mr-2 h-4 w-4" />
          Crear
        </Button>
      </form>

      {feedback ? (
        <p className="rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
          {feedback}
        </p>
      ) : null}

      {state.status === "loading" ? (
        <LoadingState title="Cargando usuarios" />
      ) : null}

      {state.status === "error" ? (
        <ErrorState
          title="No se pudo cargar"
          message={state.error}
          actionLabel="Reintentar"
          onAction={loadUsers}
        />
      ) : null}

      {state.status === "success" && state.users.length === 0 ? (
        <EmptyState title="Sin usuarios" message="Todavia no hay usuarios registrados." />
      ) : null}

      {state.status === "success" && state.users.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead className="bg-muted/70 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Creado</th>
              </tr>
            </thead>
            <tbody>
              {state.users.map((user) => (
                <tr key={user.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{user.username}</td>
                  <td className="px-4 py-3">
                    {user.role === "admin" ? "Admin" : "Usuario raso"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Intl.DateTimeFormat("es-AR").format(
                      new Date(user.createdAt)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
