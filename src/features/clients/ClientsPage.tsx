import { Edit, Plus, Save, Trash2, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Client,
  ClientInput,
  ClientsSnapshot
} from "@app/services/clients";
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

interface ClientsPageProps {
  clientsService: {
    list(this: void): Promise<ClientsSnapshot>;
    create(this: void, input: ClientInput): Promise<Client>;
    update(this: void, id: string, input: ClientInput): Promise<Client>;
    delete(this: void, id: string): Promise<void>;
  };
}

interface ClientDraft {
  id?: string;
  name: string;
  document: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  active: boolean;
}

type LoadState =
  | { status: "loading" }
  | { status: "success"; clients: Client[] }
  | { status: "error"; error: string };

const emptyClientDraft: ClientDraft = {
  name: "",
  document: "",
  email: "",
  phone: "",
  address: "",
  notes: "",
  active: true
};

export function ClientsPage({ clientsService }: ClientsPageProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [draft, setDraft] = useState<ClientDraft>(emptyClientDraft);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { notify } = useToast();

  const loadClients = useCallback(() => {
    setState({ status: "loading" });
    void clientsService
      .list()
      .then((snapshot) => {
        setState({ status: "success", clients: snapshot.clients });
      })
      .catch(() => {
        setState({
          status: "error",
          error: "No se pudieron cargar los clientes."
        });
      });
  }, [clientsService]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const clients = useMemo(
    () => (state.status === "success" ? state.clients : []),
    [state]
  );

  const saveClient = async (options: { closeAfterSave: boolean }) => {
    const input = parseClientDraft(draft);

    if (!input) {
      notify({
        type: "warning",
        message: "El nombre del cliente es obligatorio."
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (draft.id) {
        await clientsService.update(draft.id, input);
        notify({ type: "success", message: "Cliente actualizado correctamente." });
      } else {
        await clientsService.create(input);
        notify({ type: "success", message: "Cliente creado correctamente." });
      }

      setDraft(emptyClientDraft);
      if (options.closeAfterSave) {
        setDialogOpen(false);
      }
      loadClients();
    } catch (error) {
      notify({ type: "error", message: getClientErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeClient = useCallback(
    (client: Client) => {
      void clientsService
        .delete(client.id)
        .then(() => {
          notify({ type: "success", message: "Cliente eliminado." });
          loadClients();
        })
        .catch((error: unknown) => {
          notify({ type: "error", message: getClientErrorMessage(error) });
        });
    },
    [clientsService, loadClients, notify]
  );

  return (
    <section className="grid gap-6">
      <PageTitle
        eyebrow="Clientes"
        title="Gestion de clientes"
        description="Carga clientes y usalos despues al generar pedidos."
      />

      {state.status === "loading" ? (
        <LoadingState title="Cargando clientes" />
      ) : null}

      {state.status === "error" ? (
        <ErrorState
          title="No se pudo cargar"
          message={state.error}
          actionLabel="Reintentar"
          onAction={loadClients}
        />
      ) : null}

      {state.status === "success" ? (
        <>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => {
                setDraft(emptyClientDraft);
                setDialogOpen(true);
              }}
            >
              <UserPlus aria-hidden="true" className="mr-2 h-4 w-4" />
              Nuevo cliente
            </Button>
          </div>

          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setDraft(emptyClientDraft);
              }
            }}
          >
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>
                  {draft.id ? "Editar cliente" : "Nuevo cliente"}
                </DialogTitle>
                <DialogDescription>
                  Carga los datos del cliente para usarlo en pedidos.
                </DialogDescription>
              </DialogHeader>

              <ClientForm
                disabled={isSubmitting}
                draft={draft}
                onCancel={() => {
                  setDraft(emptyClientDraft);
                  setDialogOpen(false);
                }}
                onChange={setDraft}
                onSubmit={(options) => {
                  void saveClient(options);
                }}
              />
            </DialogContent>
          </Dialog>

          <ClientsList
            clients={clients}
            onDelete={removeClient}
            onEdit={(client) => {
              setDraft({
                id: client.id,
                name: client.name,
                document: client.document ?? "",
                email: client.email ?? "",
                phone: client.phone ?? "",
                address: client.address ?? "",
                notes: client.notes ?? "",
                active: client.active
              });
              setDialogOpen(true);
            }}
          />
        </>
      ) : null}
    </section>
  );
}

function ClientForm({
  disabled,
  draft,
  onCancel,
  onChange,
  onSubmit
}: {
  disabled: boolean;
  draft: ClientDraft;
  onCancel(this: void): void;
  onChange(this: void, draft: ClientDraft): void;
  onSubmit(this: void, options: { closeAfterSave: boolean }): void;
}) {
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ closeAfterSave: true });
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Nombre
          <input
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={draft.name}
            onChange={(event) => {
              onChange({ ...draft, name: event.target.value });
            }}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Documento
          <input
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={draft.document}
            onChange={(event) => {
              onChange({ ...draft, document: event.target.value });
            }}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Email
          <input
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="email"
            value={draft.email}
            onChange={(event) => {
              onChange({ ...draft, email: event.target.value });
            }}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Telefono
          <input
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={draft.phone}
            onChange={(event) => {
              onChange({ ...draft, phone: event.target.value });
            }}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium md:col-span-2">
          Direccion
          <input
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={draft.address}
            onChange={(event) => {
              onChange({ ...draft, address: event.target.value });
            }}
          />
        </label>
        <label className="flex items-center gap-3 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium">
          <input
            checked={draft.active}
            className="h-4 w-4 accent-primary"
            type="checkbox"
            onChange={(event) => {
              onChange({ ...draft, active: event.target.checked });
            }}
          />
          Activo
        </label>
      </div>

      <label className="grid gap-2 text-sm font-medium">
        Notas
        <textarea
          className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={draft.notes}
          onChange={(event) => {
            onChange({ ...draft, notes: event.target.value });
          }}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {!draft.id ? (
          <Button
            disabled={disabled}
            type="button"
            variant="secondary"
            onClick={() => onSubmit({ closeAfterSave: false })}
          >
            <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
            Agregar mas
          </Button>
        ) : null}
        <Button disabled={disabled} type="submit">
          {draft.id ? (
            <Save aria-hidden="true" className="mr-2 h-4 w-4" />
          ) : (
            <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
          )}
          {draft.id ? "Guardar" : "Crear"}
        </Button>
        {draft.id ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            <X aria-hidden="true" className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function ClientsList({
  clients,
  onDelete,
  onEdit
}: {
  clients: Client[];
  onDelete(this: void, client: Client): void;
  onEdit(this: void, client: Client): void;
}) {
  if (clients.length === 0) {
    return (
      <EmptyState
        title="Sin clientes"
        message="Todavia no hay clientes cargados."
      />
    );
  }

  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold">Clientes cargados</h2>
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card shadow-sm md:block">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <thead className="bg-muted/70 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Contacto</th>
              <th className="px-4 py-3 font-medium">Direccion</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <p className="font-medium">{client.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {client.document || "-"}
                  </p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <p>{client.email || "-"}</p>
                  <p className="mt-1">{client.phone || "-"}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {client.address || "-"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge active={client.active} />
                </td>
                <td className="px-4 py-3">
                  <ClientActions
                    client={client}
                    onDelete={onDelete}
                    onEdit={onEdit}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {clients.map((client) => (
          <article
            key={client.id}
            className="rounded-lg border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{client.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {client.document || "-"}
                </p>
              </div>
              <StatusBadge active={client.active} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="break-words font-medium">
                  {client.email || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Telefono</dt>
                <dd className="font-medium">{client.phone || "-"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Direccion</dt>
                <dd className="font-medium">{client.address || "-"}</dd>
              </div>
            </dl>
            <div className="mt-4">
              <ClientActions
                client={client}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ClientActions({
  client,
  onDelete,
  onEdit
}: {
  client: Client;
  onDelete(this: void, client: Client): void;
  onEdit(this: void, client: Client): void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        aria-label={`Editar cliente ${client.name}`}
        size="icon"
        type="button"
        variant="outline"
        onClick={() => {
          onEdit(client);
        }}
      >
        <Edit aria-hidden="true" className="h-4 w-4" />
      </Button>
      <Button
        aria-label={`Eliminar cliente ${client.name}`}
        size="icon"
        type="button"
        variant="outline"
        onClick={() => {
          onDelete(client);
        }}
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" />
      </Button>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={
        active
          ? "inline-flex rounded-md bg-success px-2 py-1 text-xs font-medium text-success-foreground"
          : "inline-flex rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
      }
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

function parseClientDraft(draft: ClientDraft): ClientInput | null {
  const name = draft.name.trim();

  if (!name) {
    return null;
  }

  return {
    name,
    ...(draft.document.trim() ? { document: draft.document.trim() } : {}),
    ...(draft.email.trim() ? { email: draft.email.trim() } : {}),
    ...(draft.phone.trim() ? { phone: draft.phone.trim() } : {}),
    ...(draft.address.trim() ? { address: draft.address.trim() } : {}),
    ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
    active: draft.active
  };
}

function getClientErrorMessage(error: unknown) {
  if (error instanceof Error && error.message === "Client name exists.") {
    return "Ya existe un cliente con ese nombre.";
  }

  if (error instanceof Error && error.message === "Client has orders.") {
    return "No se puede eliminar un cliente con pedidos asociados.";
  }

  return "No se pudo guardar el cambio en clientes.";
}
