import { ArrowDownToLine, ArrowUpFromLine, PackageCheck, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  InventoryItem,
  InventoryMovement,
  InventoryMovementInput,
  InventoryMovementType,
  InventorySnapshot
} from "@app/services/inventory";
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageTitle,
  useToast
} from "@shared/ui";

interface InventoryPageProps {
  inventoryService: {
    list(this: void): Promise<InventorySnapshot>;
    createMovement(
      this: void,
      input: InventoryMovementInput
    ): Promise<InventoryMovement>;
  };
}

interface MovementDraft {
  articleId: string;
  type: InventoryMovementType;
  quantity: string;
  reason: string;
  notes: string;
}

type LoadState =
  | { status: "loading" }
  | { status: "success"; inventory: InventorySnapshot }
  | { status: "error"; error: string };

const emptyDraft: MovementDraft = {
  articleId: "",
  type: "in",
  quantity: "",
  reason: "",
  notes: ""
};

export function InventoryPage({ inventoryService }: InventoryPageProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [draft, setDraft] = useState<MovementDraft>(emptyDraft);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { notify } = useToast();

  const loadInventory = useCallback(() => {
    setState({ status: "loading" });
    void inventoryService
      .list()
      .then((inventory) => {
        setState({ status: "success", inventory });
        setDraft((current) => ({
          ...current,
          articleId: current.articleId || inventory.items[0]?.articleId || ""
        }));
      })
      .catch(() => {
        setState({
          status: "error",
          error: "No se pudo cargar el inventario."
        });
      });
  }, [inventoryService]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const items = useMemo(
    () => (state.status === "success" ? state.inventory.items : []),
    [state]
  );
  const movements = useMemo(
    () => (state.status === "success" ? state.inventory.movements : []),
    [state]
  );
  const activeItems = useMemo(
    () => items.filter((item) => item.active),
    [items]
  );
  const totalUnits = useMemo(
    () => items.reduce((total, item) => total + item.quantity, 0),
    [items]
  );

  const submitMovement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = parseMovementDraft(draft);

    if (!input) {
      notify({
        type: "warning",
        message: "Selecciona un producto, cantidad valida y motivo."
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await inventoryService.createMovement(input);
      notify({ type: "success", message: "Movimiento registrado correctamente." });
      setDraft({
        ...emptyDraft,
        articleId: activeItems[0]?.articleId || items[0]?.articleId || ""
      });
      loadInventory();
    } catch {
      notify({
        type: "error",
        message: "No se pudo registrar el movimiento de inventario."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="grid gap-6">
      <PageTitle
        eyebrow="Inventario"
        title="Stock por producto"
        description="Registra entradas, salidas y ajustes para ver la cantidad disponible de cada articulo del catalogo."
      />

      {state.status === "loading" ? (
        <LoadingState title="Cargando inventario" />
      ) : null}

      {state.status === "error" ? (
        <ErrorState
          title="No se pudo cargar"
          message={state.error}
          actionLabel="Reintentar"
          onAction={loadInventory}
        />
      ) : null}

      {state.status === "success" ? (
        <>
          <InventorySummary
            itemCount={items.length}
            movementCount={movements.length}
            totalUnits={totalUnits}
          />

          <MovementForm
            draft={draft}
            disabled={isSubmitting || items.length === 0}
            items={activeItems.length > 0 ? activeItems : items}
            onChange={setDraft}
            onSubmit={(event) => {
              void submitMovement(event);
            }}
          />

          <InventoryStockList items={items} />
          <InventoryMovementList movements={movements} />
        </>
      ) : null}
    </section>
  );
}

function MovementForm({
  draft,
  disabled,
  items,
  onChange,
  onSubmit
}: {
  draft: MovementDraft;
  disabled: boolean;
  items: InventoryItem[];
  onChange(this: void, draft: MovementDraft): void;
  onSubmit(this: void, event: FormEvent<HTMLFormElement>): void;
}) {
  return (
    <form
      className="grid gap-4 rounded-lg border border-border bg-card p-4 shadow-sm"
      onSubmit={onSubmit}
    >
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <PackageCheck aria-hidden="true" className="h-4 w-4 text-primary" />
          Nuevo movimiento
        </h2>
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-border bg-muted/60 p-3 text-sm text-muted-foreground">
          Primero carga articulos activos en el catalogo.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[1.4fr_12rem_10rem_1fr_auto] md:items-end">
        <label className="grid gap-2 text-sm font-medium">
          Producto
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={draft.articleId}
            onChange={(event) => {
              onChange({ ...draft, articleId: event.target.value });
            }}
          >
            <option value="">Seleccionar</option>
            {items.map((item) => (
              <option key={item.articleId} value={item.articleId}>
                {item.articleName}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium">
          Tipo
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={draft.type}
            onChange={(event) => {
              onChange({
                ...draft,
                type: readMovementType(event.target.value)
              });
            }}
          >
            <option value="in">Entrada</option>
            <option value="out">Salida</option>
            <option value="adjustment">Ajuste</option>
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium">
          Cantidad
          <input
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            step="0.01"
            type="number"
            value={draft.quantity}
            onChange={(event) => {
              onChange({ ...draft, quantity: event.target.value });
            }}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium">
          Motivo
          <input
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={draft.reason}
            onChange={(event) => {
              onChange({ ...draft, reason: event.target.value });
            }}
          />
        </label>

        <Button disabled={disabled} type="submit">
          Registrar
        </Button>
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
    </form>
  );
}

function InventorySummary({
  itemCount,
  movementCount,
  totalUnits
}: {
  itemCount: number;
  movementCount: number;
  totalUnits: number;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SummaryTile label="Productos" value={itemCount} />
      <SummaryTile label="Unidades" value={formatQuantity(totalUnits)} />
      <SummaryTile label="Movimientos" value={movementCount} />
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function InventoryStockList({ items }: { items: InventoryItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Sin productos"
        message="Todavia no hay articulos cargados en el catalogo."
      />
    );
  }

  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold">Stock actual</h2>
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card shadow-sm md:block">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="bg-muted/70 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Producto</th>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Unidad</th>
              <th className="px-4 py-3 font-medium">Cantidad</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.articleId} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{item.articleName}</td>
                <td className="px-4 py-3">{item.categoryName}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {item.sku || "-"}
                </td>
                <td className="px-4 py-3">{item.unit || "-"}</td>
                <td className="px-4 py-3 text-base font-semibold">
                  {formatQuantity(item.quantity)}
                </td>
                <td className="px-4 py-3">
                  <StockBadge quantity={item.quantity} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {items.map((item) => (
          <article
            key={item.articleId}
            className="rounded-lg border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {item.articleName}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.categoryName}
                </p>
              </div>
              <StockBadge quantity={item.quantity} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">SKU</dt>
                <dd className="font-medium">{item.sku || "-"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Unidad</dt>
                <dd className="font-medium">{item.unit || "-"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Cantidad</dt>
                <dd className="text-lg font-semibold">
                  {formatQuantity(item.quantity)}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

function InventoryMovementList({
  movements
}: {
  movements: InventoryMovement[];
}) {
  if (movements.length === 0) {
    return (
      <EmptyState
        title="Sin movimientos de inventario"
        message="Todavia no registraste entradas, salidas ni ajustes."
      />
    );
  }

  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold">Ultimos movimientos</h2>
      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="bg-muted/70 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Producto</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Cantidad</th>
              <th className="px-4 py-3 font-medium">Motivo</th>
              <th className="px-4 py-3 font-medium">Notas</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((movement) => (
              <tr key={movement.id} className="border-t border-border">
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDate(movement.createdAt)}
                </td>
                <td className="px-4 py-3 font-medium">
                  {movement.articleName}
                </td>
                <td className="px-4 py-3">
                  <MovementBadge type={movement.type} />
                </td>
                <td className="px-4 py-3 font-semibold">
                  {formatQuantity(movement.quantity)}
                </td>
                <td className="px-4 py-3">{movement.reason}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {movement.notes || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StockBadge({ quantity }: { quantity: number }) {
  const isAvailable = quantity > 0;

  return (
    <span
      className={
        isAvailable
          ? "inline-flex rounded-md bg-success px-2 py-1 text-xs font-medium text-success-foreground"
          : "inline-flex rounded-md bg-warning px-2 py-1 text-xs font-medium text-warning-foreground"
      }
    >
      {isAvailable ? "Con stock" : "Sin stock"}
    </span>
  );
}

function MovementBadge({ type }: { type: InventoryMovementType }) {
  const styles = {
    in: {
      label: "Entrada",
      className: "bg-success text-success-foreground",
      icon: ArrowDownToLine
    },
    out: {
      label: "Salida",
      className: "bg-destructive text-destructive-foreground",
      icon: ArrowUpFromLine
    },
    adjustment: {
      label: "Ajuste",
      className: "bg-primary text-primary-foreground",
      icon: SlidersHorizontal
    }
  } satisfies Record<
    InventoryMovementType,
    { label: string; className: string; icon: typeof ArrowDownToLine }
  >;
  const style = styles[type];
  const Icon = style.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${style.className}`}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {style.label}
    </span>
  );
}

function parseMovementDraft(draft: MovementDraft): InventoryMovementInput | null {
  const articleId = draft.articleId.trim();
  const quantity = Number(draft.quantity);
  const reason = draft.reason.trim();

  if (
    !articleId ||
    !reason ||
    !Number.isFinite(quantity) ||
    quantity === 0 ||
    (draft.type !== "adjustment" && quantity <= 0)
  ) {
    return null;
  }

  return {
    articleId,
    type: draft.type,
    quantity,
    reason,
    ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {})
  };
}

function readMovementType(value: string): InventoryMovementType {
  return value === "out" || value === "adjustment" ? value : "in";
}

function formatQuantity(quantity: number) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 2
  }).format(quantity);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}
