import { Plus, Save, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type {
  AppUser,
  CreateUserInput,
  SalesProfileInput,
  UserRole
} from "@app/services/users";
import { useAuth } from "@features/auth";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  LoadingState,
  PageTitle,
  useToast
} from "@shared/ui";

interface UsersPageProps {
  usersService: {
    list(this: void): Promise<AppUser[]>;
    create(this: void, input: CreateUserInput): Promise<AppUser>;
    updateSalesProfile(
      this: void,
      id: string,
      input: SalesProfileInput
    ): Promise<unknown>;
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
  const [salesProfileForm, setSalesProfileForm] = useState<SalesProfileInput>({
    catalogUserId: "",
    commissionRate: 0,
    bonusGoalAmount: 0,
    bonusAmount: 0
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const { notify } = useToast();

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

  const submitUser = async (options: { closeAfterSave: boolean }) => {
    if (form.username.trim().length === 0 || form.password.length < 8) {
      notify({
        type: "warning",
        message:
          "El usuario es obligatorio y la contrasena debe tener al menos 8 caracteres."
      });
      return;
    }

    if (form.role === "seller" && salesProfileForm.catalogUserId.length === 0) {
      notify({
        type: "warning",
        message: "Selecciona el usuario operativo para el vendedor."
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await usersService.create({
        username: form.username.trim(),
        password: form.password,
        role: form.role,
        ...(form.role === "seller" ? { salesProfile: salesProfileForm } : {})
      });
      setForm({ username: "", password: "", role: "user" });
      setSalesProfileForm({
        catalogUserId: "",
        commissionRate: 0,
        bonusGoalAmount: 0,
        bonusAmount: 0
      });
      notify({ type: "success", message: "Usuario creado correctamente." });
      if (options.closeAfterSave) {
        setFormOpen(false);
      }
      loadUsers();
    } catch {
      notify({
        type: "error",
        message: "No se pudo crear el usuario. Revisa que el nombre no exista."
      });
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

      <div className="flex justify-end">
        <Button type="button" onClick={() => setFormOpen(true)}>
          <UserPlus aria-hidden="true" className="mr-2 h-4 w-4" />
          Nuevo usuario
        </Button>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
            <DialogDescription>
              Crea accesos para usuarios, vendedores y administradores.
            </DialogDescription>
          </DialogHeader>

          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submitUser({ closeAfterSave: true });
            }}
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
              Contrasena
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
                  const role = readUserRole(event.target.value);

                  setForm((current) => ({ ...current, role }));
                }}
              >
                <option value="user">Usuario raso</option>
                <option value="seller">Vendedor</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            {form.role === "seller" ? (
              <SalesProfileFields
                profile={salesProfileForm}
                users={
                  state.status === "success"
                    ? state.users.filter((user) => user.role === "user")
                    : []
                }
                onChange={setSalesProfileForm}
              />
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                disabled={isSubmitting}
                type="button"
                variant="secondary"
                onClick={() => void submitUser({ closeAfterSave: false })}
              >
                <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
                Agregar mas
              </Button>
              <Button disabled={isSubmitting} type="submit">
                <UserPlus aria-hidden="true" className="mr-2 h-4 w-4" />
                Crear
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
        <EmptyState
          title="Sin usuarios"
          message="Todavia no hay usuarios registrados."
        />
      ) : null}

      {state.status === "success" && state.users.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead className="bg-muted/70 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Comision</th>
                <th className="px-4 py-3 font-medium">Premio</th>
                <th className="px-4 py-3 font-medium">Creado</th>
                <th className="px-4 py-3 font-medium">Configurar</th>
              </tr>
            </thead>
            <tbody>
              {state.users.map((user) => (
                <tr key={user.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{user.username}</td>
                  <td className="px-4 py-3">
                    {formatRole(user.role)}
                  </td>
                  <td className="px-4 py-3">
                    {user.role === "seller"
                      ? `${formatPercent(user.salesProfile?.commissionRate ?? 0)}`
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    {user.role === "seller"
                      ? `${formatMoney(user.salesProfile?.bonusAmount ?? 0)} desde ${formatMoney(
                          user.salesProfile?.bonusGoalAmount ?? 0
                        )}`
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Intl.DateTimeFormat("es-AR").format(
                      new Date(user.createdAt)
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.role === "seller" ? (
                      <SellerProfileEditor
                        seller={user}
                        users={state.users.filter((item) => item.role === "user")}
                        usersService={usersService}
                        onSaved={loadUsers}
                      />
                    ) : (
                      <span className="text-muted-foreground">-</span>
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

function SalesProfileFields({
  profile,
  users,
  onChange
}: {
  profile: SalesProfileInput;
  users: AppUser[];
  onChange(this: void, profile: SalesProfileInput): void;
}) {
  return (
    <div className="grid gap-4 rounded-md border border-border bg-muted/30 p-3">
      <label className="grid gap-2 text-sm font-medium">
        Usuario operativo
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={profile.catalogUserId}
          onChange={(event) => {
            onChange({ ...profile, catalogUserId: event.target.value });
          }}
        >
          <option value="">Seleccionar</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.username}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <NumberField
          label="Comision %"
          value={profile.commissionRate}
          onChange={(commissionRate) => {
            onChange({ ...profile, commissionRate });
          }}
        />
        <NumberField
          label="Objetivo premio"
          value={profile.bonusGoalAmount}
          onChange={(bonusGoalAmount) => {
            onChange({ ...profile, bonusGoalAmount });
          }}
        />
        <NumberField
          label="Premio"
          value={profile.bonusAmount}
          onChange={(bonusAmount) => {
            onChange({ ...profile, bonusAmount });
          }}
        />
      </div>
    </div>
  );
}

function SellerProfileEditor({
  seller,
  users,
  usersService,
  onSaved
}: {
  seller: AppUser;
  users: AppUser[];
  usersService: UsersPageProps["usersService"];
  onSaved(this: void): void;
}) {
  const [profile, setProfile] = useState<SalesProfileInput>({
    catalogUserId: seller.salesProfile?.catalogUserId ?? "",
    commissionRate: seller.salesProfile?.commissionRate ?? 0,
    bonusGoalAmount: seller.salesProfile?.bonusGoalAmount ?? 0,
    bonusAmount: seller.salesProfile?.bonusAmount ?? 0
  });
  const [isSaving, setIsSaving] = useState(false);
  const { notify } = useToast();

  useEffect(() => {
    setProfile({
      catalogUserId: seller.salesProfile?.catalogUserId ?? "",
      commissionRate: seller.salesProfile?.commissionRate ?? 0,
      bonusGoalAmount: seller.salesProfile?.bonusGoalAmount ?? 0,
      bonusAmount: seller.salesProfile?.bonusAmount ?? 0
    });
  }, [seller.salesProfile]);

  const save = async () => {
    if (profile.catalogUserId.length === 0) {
      notify({
        type: "warning",
        message: "Selecciona el usuario operativo del vendedor."
      });
      return;
    }

    setIsSaving(true);

    try {
      await usersService.updateSalesProfile(seller.id, profile);
      notify({ type: "success", message: "Configuracion guardada." });
      onSaved();
    } catch {
      notify({
        type: "error",
        message: "No se pudo guardar la configuracion del vendedor."
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid min-w-[28rem] gap-2">
      <div className="grid gap-2 md:grid-cols-[1fr_7rem_8rem_8rem_auto]">
        <select
          aria-label="Usuario operativo"
          className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={profile.catalogUserId}
          onChange={(event) => {
            setProfile({ ...profile, catalogUserId: event.target.value });
          }}
        >
          <option value="">Operativo</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.username}
            </option>
          ))}
        </select>
        <NumberInput
          ariaLabel="Comision"
          value={profile.commissionRate}
          onChange={(commissionRate) => {
            setProfile({ ...profile, commissionRate });
          }}
        />
        <NumberInput
          ariaLabel="Objetivo premio"
          value={profile.bonusGoalAmount}
          onChange={(bonusGoalAmount) => {
            setProfile({ ...profile, bonusGoalAmount });
          }}
        />
        <NumberInput
          ariaLabel="Premio"
          value={profile.bonusAmount}
          onChange={(bonusAmount) => {
            setProfile({ ...profile, bonusAmount });
          }}
        />
        <Button
          aria-label="Guardar configuracion"
          disabled={isSaving}
          size="icon"
          type="button"
          variant="outline"
          onClick={() => void save()}
        >
          <Save aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange(this: void, value: number): void;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <NumberInput ariaLabel={label} value={value} onChange={onChange} />
    </label>
  );
}

function NumberInput({
  ariaLabel,
  value,
  onChange
}: {
  ariaLabel: string;
  value: number;
  onChange(this: void, value: number): void;
}) {
  return (
    <input
      aria-label={ariaLabel}
      className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      min="0"
      step="0.01"
      type="number"
      value={String(value)}
      onChange={(event) => {
        const nextValue = Number(event.target.value);

        onChange(Number.isFinite(nextValue) ? nextValue : 0);
      }}
    />
  );
}

function readUserRole(value: string): UserRole {
  if (value === "admin" || value === "seller") {
    return value;
  }

  return "user";
}

function formatRole(role: UserRole) {
  const labels = {
    admin: "Admin",
    user: "Usuario raso",
    seller: "Vendedor"
  } satisfies Record<UserRole, string>;

  return labels[role];
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 2
  }).format(value)}%`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS"
  }).format(value);
}
