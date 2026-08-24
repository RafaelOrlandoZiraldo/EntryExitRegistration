import { Edit, Plus, Save, Trash2, Truck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  Supplier,
  SupplierInput,
  SuppliersSnapshot
} from "@app/services/suppliers";
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

interface SuppliersPageProps {
  suppliersService: {
    list(this: void): Promise<SuppliersSnapshot>;
    create(this: void, input: SupplierInput): Promise<Supplier>;
    update(this: void, id: string, input: SupplierInput): Promise<Supplier>;
    delete(this: void, id: string): Promise<void>;
  };
}

interface SupplierDraft {
  id?: string;
  name: string;
  taxId: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  country: string;
  paymentTerms: string;
  bankAccount: string;
  category: string;
  notes: string;
  active: boolean;
}

type LoadState =
  | { status: "loading" }
  | { status: "success"; suppliers: Supplier[] }
  | { status: "error"; error: string };

const emptySupplierDraft: SupplierDraft = {
  name: "",
  taxId: "",
  contactName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  province: "",
  country: "Argentina",
  paymentTerms: "",
  bankAccount: "",
  category: "",
  notes: "",
  active: true
};

const fieldClassName =
  "h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function SuppliersPage({ suppliersService }: SuppliersPageProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [draft, setDraft] = useState<SupplierDraft>(emptySupplierDraft);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { notify } = useToast();

  const loadSuppliers = useCallback(() => {
    setState({ status: "loading" });
    void suppliersService
      .list()
      .then((snapshot) => {
        setState({ status: "success", suppliers: snapshot.suppliers });
      })
      .catch(() => {
        setState({
          status: "error",
          error: "No se pudieron cargar los proveedores."
        });
      });
  }, [suppliersService]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const suppliers = useMemo(
    () => (state.status === "success" ? state.suppliers : []),
    [state]
  );

  const saveSupplier = async (options: { closeAfterSave: boolean }) => {
    const input = parseSupplierDraft(draft);

    if (!input) {
      notify({
        type: "warning",
        message: "La razon social o nombre del proveedor es obligatorio."
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (draft.id) {
        await suppliersService.update(draft.id, input);
        notify({
          type: "success",
          message: "Proveedor actualizado correctamente."
        });
      } else {
        await suppliersService.create(input);
        notify({ type: "success", message: "Proveedor creado correctamente." });
      }

      setDraft(emptySupplierDraft);
      if (options.closeAfterSave) {
        setDialogOpen(false);
      }
      loadSuppliers();
    } catch (error) {
      notify({ type: "error", message: getSupplierErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeSupplier = useCallback(
    (supplier: Supplier) => {
      void suppliersService
        .delete(supplier.id)
        .then(() => {
          notify({ type: "success", message: "Proveedor eliminado." });
          loadSuppliers();
        })
        .catch((error: unknown) => {
          notify({ type: "error", message: getSupplierErrorMessage(error) });
        });
    },
    [loadSuppliers, notify, suppliersService]
  );

  return (
    <section className="grid gap-6">
      <PageTitle
        eyebrow="Proveedores"
        title="Gestion de proveedores"
        description="Carga datos fiscales, comerciales y de contacto para usarlos en compras."
      />

      {state.status === "loading" ? (
        <LoadingState title="Cargando proveedores" />
      ) : null}

      {state.status === "error" ? (
        <ErrorState
          title="No se pudo cargar"
          message={state.error}
          actionLabel="Reintentar"
          onAction={loadSuppliers}
        />
      ) : null}

      {state.status === "success" ? (
        <>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => {
                setDraft(emptySupplierDraft);
                setDialogOpen(true);
              }}
            >
              <Truck aria-hidden="true" className="mr-2 h-4 w-4" />
              Nuevo proveedor
            </Button>
          </div>

          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                setDraft(emptySupplierDraft);
              }
            }}
          >
            <DialogContent className="max-w-5xl">
              <DialogHeader>
                <DialogTitle>
                  {draft.id ? "Editar proveedor" : "Nuevo proveedor"}
                </DialogTitle>
                <DialogDescription>
                  Carga datos fiscales, contacto, ubicacion y condiciones de
                  compra.
                </DialogDescription>
              </DialogHeader>

              <SupplierForm
                disabled={isSubmitting}
                draft={draft}
                onCancel={() => {
                  setDraft(emptySupplierDraft);
                  setDialogOpen(false);
                }}
                onChange={setDraft}
                onSubmit={(options) => {
                  void saveSupplier(options);
                }}
              />
            </DialogContent>
          </Dialog>

          <SuppliersList
            suppliers={suppliers}
            onDelete={removeSupplier}
            onEdit={(supplier) => {
              setDraft({
                id: supplier.id,
                name: supplier.name,
                taxId: supplier.taxId ?? "",
                contactName: supplier.contactName ?? "",
                email: supplier.email ?? "",
                phone: supplier.phone ?? "",
                address: supplier.address ?? "",
                city: supplier.city ?? "",
                province: supplier.province ?? "",
                country: supplier.country ?? "",
                paymentTerms: supplier.paymentTerms ?? "",
                bankAccount: supplier.bankAccount ?? "",
                category: supplier.category ?? "",
                notes: supplier.notes ?? "",
                active: supplier.active
              });
              setDialogOpen(true);
            }}
          />
        </>
      ) : null}
    </section>
  );
}

function SupplierForm({
  disabled,
  draft,
  onCancel,
  onChange,
  onSubmit
}: {
  disabled: boolean;
  draft: SupplierDraft;
  onCancel(this: void): void;
  onChange(this: void, draft: SupplierDraft): void;
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
        <Field
          label="Razon social"
          value={draft.name}
          onChange={(name) => onChange({ ...draft, name })}
        />
        <Field
          label="CUIT / Documento fiscal"
          value={draft.taxId}
          onChange={(taxId) => onChange({ ...draft, taxId })}
        />
        <Field
          label="Contacto"
          value={draft.contactName}
          onChange={(contactName) => onChange({ ...draft, contactName })}
        />
        <Field
          label="Email"
          type="email"
          value={draft.email}
          onChange={(email) => onChange({ ...draft, email })}
        />
        <Field
          label="Telefono"
          value={draft.phone}
          onChange={(phone) => onChange({ ...draft, phone })}
        />
        <Field
          label="Rubro"
          value={draft.category}
          onChange={(category) => onChange({ ...draft, category })}
        />
        <Field
          className="md:col-span-2"
          label="Direccion"
          value={draft.address}
          onChange={(address) => onChange({ ...draft, address })}
        />
        <Field
          label="Localidad"
          value={draft.city}
          onChange={(city) => onChange({ ...draft, city })}
        />
        <Field
          label="Provincia"
          value={draft.province}
          onChange={(province) => onChange({ ...draft, province })}
        />
        <Field
          label="Pais"
          value={draft.country}
          onChange={(country) => onChange({ ...draft, country })}
        />
        <Field
          label="Condiciones de pago"
          value={draft.paymentTerms}
          onChange={(paymentTerms) => onChange({ ...draft, paymentTerms })}
        />
        <Field
          className="md:col-span-2"
          label="Cuenta bancaria / Alias"
          value={draft.bankAccount}
          onChange={(bankAccount) => onChange({ ...draft, bankAccount })}
        />
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

function Field({
  className,
  label,
  type = "text",
  value,
  onChange
}: {
  className?: string;
  label: string;
  type?: string;
  value: string;
  onChange(this: void, value: string): void;
}) {
  return (
    <label className={`grid gap-2 text-sm font-medium ${className ?? ""}`}>
      {label}
      <input
        className={fieldClassName}
        type={type}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
      />
    </label>
  );
}

function SuppliersList({
  suppliers,
  onDelete,
  onEdit
}: {
  suppliers: Supplier[];
  onDelete(this: void, supplier: Supplier): void;
  onEdit(this: void, supplier: Supplier): void;
}) {
  if (suppliers.length === 0) {
    return (
      <EmptyState
        title="Sin proveedores"
        message="Todavia no hay proveedores cargados."
      />
    );
  }

  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold">Proveedores cargados</h2>
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card shadow-sm md:block">
        <table className="w-full min-w-[1080px] border-collapse text-sm">
          <thead className="bg-muted/70 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Proveedor</th>
              <th className="px-4 py-3 font-medium">Contacto</th>
              <th className="px-4 py-3 font-medium">Ubicacion</th>
              <th className="px-4 py-3 font-medium">Compra</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((supplier) => (
              <tr key={supplier.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <p className="font-medium">{supplier.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {supplier.taxId || supplier.category || "-"}
                  </p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <p>{supplier.contactName || supplier.email || "-"}</p>
                  <p className="mt-1">{supplier.phone || "-"}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatLocation(supplier)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  <p>{supplier.paymentTerms || "-"}</p>
                  <p className="mt-1 text-xs">{supplier.bankAccount || ""}</p>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge active={supplier.active} />
                </td>
                <td className="px-4 py-3">
                  <SupplierActions
                    supplier={supplier}
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
        {suppliers.map((supplier) => (
          <article
            key={supplier.id}
            className="rounded-lg border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {supplier.name}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {supplier.taxId || supplier.category || "-"}
                </p>
              </div>
              <StatusBadge active={supplier.active} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Contacto</dt>
                <dd className="break-words font-medium">
                  {supplier.contactName || supplier.email || "-"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Telefono</dt>
                <dd className="font-medium">{supplier.phone || "-"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Ubicacion</dt>
                <dd className="font-medium">{formatLocation(supplier)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Pago</dt>
                <dd className="font-medium">{supplier.paymentTerms || "-"}</dd>
              </div>
            </dl>
            <div className="mt-4">
              <SupplierActions
                supplier={supplier}
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

function SupplierActions({
  supplier,
  onDelete,
  onEdit
}: {
  supplier: Supplier;
  onDelete(this: void, supplier: Supplier): void;
  onEdit(this: void, supplier: Supplier): void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        aria-label={`Editar proveedor ${supplier.name}`}
        size="icon"
        type="button"
        variant="outline"
        onClick={() => {
          onEdit(supplier);
        }}
      >
        <Edit aria-hidden="true" className="h-4 w-4" />
      </Button>
      <Button
        aria-label={`Eliminar proveedor ${supplier.name}`}
        size="icon"
        type="button"
        variant="outline"
        onClick={() => {
          onDelete(supplier);
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

function formatLocation(supplier: Supplier) {
  return (
    [supplier.address, supplier.city, supplier.province, supplier.country]
      .filter(Boolean)
      .join(", ") || "-"
  );
}

function parseSupplierDraft(draft: SupplierDraft): SupplierInput | null {
  const name = draft.name.trim();

  if (!name) {
    return null;
  }

  return {
    name,
    ...(draft.taxId.trim() ? { taxId: draft.taxId.trim() } : {}),
    ...(draft.contactName.trim()
      ? { contactName: draft.contactName.trim() }
      : {}),
    ...(draft.email.trim() ? { email: draft.email.trim() } : {}),
    ...(draft.phone.trim() ? { phone: draft.phone.trim() } : {}),
    ...(draft.address.trim() ? { address: draft.address.trim() } : {}),
    ...(draft.city.trim() ? { city: draft.city.trim() } : {}),
    ...(draft.province.trim() ? { province: draft.province.trim() } : {}),
    ...(draft.country.trim() ? { country: draft.country.trim() } : {}),
    ...(draft.paymentTerms.trim()
      ? { paymentTerms: draft.paymentTerms.trim() }
      : {}),
    ...(draft.bankAccount.trim()
      ? { bankAccount: draft.bankAccount.trim() }
      : {}),
    ...(draft.category.trim() ? { category: draft.category.trim() } : {}),
    ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
    active: draft.active
  };
}

function getSupplierErrorMessage(error: unknown) {
  if (error instanceof Error && error.message === "Supplier name exists.") {
    return "Ya existe un proveedor con ese nombre.";
  }

  if (
    error instanceof Error &&
    error.message === "Supplier has purchase orders."
  ) {
    return "No se puede eliminar un proveedor con ordenes de compra asociadas.";
  }

  return "No se pudo guardar el cambio en proveedores.";
}
