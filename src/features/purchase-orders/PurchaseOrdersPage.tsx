import {
  CheckCircle2,
  Clock3,
  Minus,
  PackagePlus,
  Plus,
  Send,
  ShoppingBag,
  XCircle
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { InventoryItem, InventorySnapshot } from "@app/services/inventory";
import type {
  PurchaseOrder,
  PurchaseOrderInput,
  PurchaseOrderStatus,
  PurchaseOrdersSnapshot
} from "@app/services/purchaseOrders";
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

interface PurchaseOrdersPageProps {
  inventoryService: {
    list(this: void): Promise<InventorySnapshot>;
  };
  purchaseOrdersService: {
    list(this: void): Promise<PurchaseOrdersSnapshot>;
    create(this: void, input: PurchaseOrderInput): Promise<PurchaseOrder>;
    updateStatus(
      this: void,
      id: string,
      status: Exclude<PurchaseOrderStatus, "draft">
    ): Promise<PurchaseOrder>;
  };
}

interface OrderLineDraft {
  articleId: string;
  quantity: string;
  unitCost: string;
  notes: string;
}

interface OrderDraft {
  supplierName: string;
  supplierContact: string;
  expectedDate: string;
  status: Exclude<PurchaseOrderStatus, "cancelled">;
  paymentTerms: string;
  notes: string;
  items: OrderLineDraft[];
}

type LoadState =
  | { status: "loading" }
  | { status: "success"; inventory: InventorySnapshot; orders: PurchaseOrder[] }
  | { status: "error"; error: string };

const emptyDraft: OrderDraft = {
  supplierName: "",
  supplierContact: "",
  expectedDate: "",
  status: "draft",
  paymentTerms: "",
  notes: "",
  items: [{ articleId: "", quantity: "1", unitCost: "0", notes: "" }]
};

export function PurchaseOrdersPage({
  inventoryService,
  purchaseOrdersService
}: PurchaseOrdersPageProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [draft, setDraft] = useState<OrderDraft>(emptyDraft);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const { notify } = useToast();

  const loadPurchaseOrders = useCallback(() => {
    setState({ status: "loading" });
    void Promise.all([inventoryService.list(), purchaseOrdersService.list()])
      .then(([inventory, ordersSnapshot]) => {
        setState({
          status: "success",
          inventory,
          orders: ordersSnapshot.orders
        });
        setDraft((current) => ({
          ...current,
          items: current.items.map((line) => ({
            ...line,
            articleId: line.articleId || inventory.items[0]?.articleId || ""
          }))
        }));
      })
      .catch(() => {
        setState({
          status: "error",
          error: "No se pudieron cargar las ordenes de compra."
        });
      });
  }, [inventoryService, purchaseOrdersService]);

  useEffect(() => {
    loadPurchaseOrders();
  }, [loadPurchaseOrders]);

  const items = useMemo(
    () => (state.status === "success" ? state.inventory.items : []),
    [state]
  );
  const activeItems = useMemo(
    () => items.filter((item) => item.active),
    [items]
  );
  const orders = useMemo(
    () => (state.status === "success" ? state.orders : []),
    [state]
  );
  const draftTotal = useMemo(
    () =>
      draft.items.reduce((total, line) => {
        const quantity = Number(line.quantity);
        const unitCost = Number(line.unitCost);

        if (!Number.isFinite(quantity) || !Number.isFinite(unitCost)) {
          return total;
        }

        return total + quantity * unitCost;
      }, 0),
    [draft.items]
  );

  const resetDraft = useCallback(() => {
    setDraft({
      ...emptyDraft,
      items: [
        {
          articleId: activeItems[0]?.articleId || items[0]?.articleId || "",
          quantity: "1",
          unitCost: "0",
          notes: ""
        }
      ]
    });
  }, [activeItems, items]);

  const submitOrder = async (options: { closeAfterSave: boolean }) => {
    const input = parseOrderDraft(draft);

    if (!input) {
      notify({
        type: "warning",
        message:
          "Carga proveedor y al menos un producto con cantidad y costo validos."
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await purchaseOrdersService.create(input);
      notify({
        type: "success",
        message:
          input.status === "received"
            ? "Orden recibida e inventario actualizado."
            : "Orden de compra creada correctamente."
      });
      resetDraft();
      if (options.closeAfterSave) {
        setFormOpen(false);
      }
      loadPurchaseOrders();
    } catch (error) {
      notify({ type: "error", message: getPurchaseOrderErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = useCallback(
    (order: PurchaseOrder, status: Exclude<PurchaseOrderStatus, "draft">) => {
      void purchaseOrdersService
        .updateStatus(order.id, status)
        .then(() => {
          notify({
            type: "success",
            message:
              status === "received"
                ? "Orden recibida e inventario actualizado."
                : "Estado actualizado."
          });
          loadPurchaseOrders();
        })
        .catch((error: unknown) => {
          notify({
            type: "error",
            message: getPurchaseOrderErrorMessage(error)
          });
        });
    },
    [loadPurchaseOrders, notify, purchaseOrdersService]
  );

  return (
    <section className="grid gap-6">
      <PageTitle
        eyebrow="Compras"
        title="Ordenes de compra"
        description="Registra compras a proveedores y recibe mercaderia para impactar stock automaticamente."
      />

      {state.status === "loading" ? (
        <LoadingState title="Cargando ordenes de compra" />
      ) : null}

      {state.status === "error" ? (
        <ErrorState
          title="No se pudo cargar"
          message={state.error}
          actionLabel="Reintentar"
          onAction={loadPurchaseOrders}
        />
      ) : null}

      {state.status === "success" ? (
        <>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => {
                resetDraft();
                setFormOpen(true);
              }}
            >
              <ShoppingBag aria-hidden="true" className="mr-2 h-4 w-4" />
              Nueva orden
            </Button>
          </div>

          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <DialogContent className="max-w-5xl">
              <DialogHeader>
                <DialogTitle>Nueva orden de compra</DialogTitle>
                <DialogDescription>
                  Carga el proveedor, productos, costos y estado inicial.
                </DialogDescription>
              </DialogHeader>

              <PurchaseOrderForm
                draft={draft}
                disabled={isSubmitting || items.length === 0}
                items={activeItems.length > 0 ? activeItems : items}
                total={draftTotal}
                onChange={setDraft}
                onSubmit={(options) => {
                  void submitOrder(options);
                }}
              />
            </DialogContent>
          </Dialog>

          <PurchaseOrdersList orders={orders} onStatusChange={updateStatus} />
        </>
      ) : null}
    </section>
  );
}

function PurchaseOrderForm({
  draft,
  disabled,
  items,
  total,
  onChange,
  onSubmit
}: {
  draft: OrderDraft;
  disabled: boolean;
  items: InventoryItem[];
  total: number;
  onChange(this: void, draft: OrderDraft): void;
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
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border bg-muted/40 p-3">
        <div>
          <p className="text-sm font-semibold">Detalle de compra</p>
          <p className="text-xs text-muted-foreground">
            Si la creas como recibida, el stock se actualiza al guardar.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total estimado</p>
          <p className="text-2xl font-semibold">{formatMoney(total)}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-border bg-muted/60 p-3 text-sm text-muted-foreground">
          Primero carga articulos activos en el catalogo.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr_11rem]">
        <label className="grid gap-2 text-sm font-medium">
          Proveedor
          <input
            className={fieldClassName}
            value={draft.supplierName}
            onChange={(event) => {
              onChange({ ...draft, supplierName: event.target.value });
            }}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Contacto
          <input
            className={fieldClassName}
            placeholder="telefono, email o referente"
            value={draft.supplierContact}
            onChange={(event) => {
              onChange({ ...draft, supplierContact: event.target.value });
            }}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Fecha esperada
          <input
            className={fieldClassName}
            type="date"
            value={draft.expectedDate}
            onChange={(event) => {
              onChange({ ...draft, expectedDate: event.target.value });
            }}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-[12rem_1fr]">
        <label className="grid gap-2 text-sm font-medium">
          Estado inicial
          <select
            className={fieldClassName}
            value={draft.status}
            onChange={(event) => {
              onChange({
                ...draft,
                status: readDraftStatus(event.target.value)
              });
            }}
          >
            <option value="draft">Borrador</option>
            <option value="sent">Enviada</option>
            <option value="received">Recibida</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Condiciones de pago
          <input
            className={fieldClassName}
            placeholder="contado, 15 dias, transferencia"
            value={draft.paymentTerms}
            onChange={(event) => {
              onChange({ ...draft, paymentTerms: event.target.value });
            }}
          />
        </label>
      </div>

      <div className="grid gap-3">
        {draft.items.map((line, index) => (
          <PurchaseOrderLineEditor
            key={index}
            canRemove={draft.items.length > 1}
            items={items}
            line={line}
            onChange={(nextLine) => {
              onChange({
                ...draft,
                items: draft.items.map((item, itemIndex) =>
                  itemIndex === index ? nextLine : item
                )
              });
            }}
            onRemove={() => {
              onChange({
                ...draft,
                items: draft.items.filter((_, itemIndex) => itemIndex !== index)
              });
            }}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={disabled}
          type="button"
          variant="outline"
          onClick={() => {
            onChange({
              ...draft,
              items: [
                ...draft.items,
                {
                  articleId: items[0]?.articleId || "",
                  quantity: "1",
                  unitCost: "0",
                  notes: ""
                }
              ]
            });
          }}
        >
          <PackagePlus aria-hidden="true" className="mr-2 h-4 w-4" />
          Producto
        </Button>
      </div>

      <label className="grid gap-2 text-sm font-medium">
        Observaciones
        <textarea
          className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={draft.notes}
          onChange={(event) => {
            onChange({ ...draft, notes: event.target.value });
          }}
        />
      </label>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          disabled={disabled}
          type="button"
          variant="secondary"
          onClick={() => onSubmit({ closeAfterSave: false })}
        >
          <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
          Agregar mas
        </Button>
        <Button disabled={disabled} type="submit">
          <ShoppingBag aria-hidden="true" className="mr-2 h-4 w-4" />
          Crear orden
        </Button>
      </div>
    </form>
  );
}

function PurchaseOrderLineEditor({
  canRemove,
  items,
  line,
  onChange,
  onRemove
}: {
  canRemove: boolean;
  items: InventoryItem[];
  line: OrderLineDraft;
  onChange(this: void, line: OrderLineDraft): void;
  onRemove(this: void): void;
}) {
  const quantity = Number(line.quantity);
  const unitCost = Number(line.unitCost);
  const lineTotal =
    Number.isFinite(quantity) && Number.isFinite(unitCost)
      ? quantity * unitCost
      : 0;

  return (
    <div className="grid gap-3 rounded-md border border-border bg-background p-3 md:grid-cols-[1.5fr_8rem_9rem_9rem_auto] md:items-end">
      <label className="grid gap-2 text-sm font-medium">
        Producto
        <select
          className={fieldClassName}
          value={line.articleId}
          onChange={(event) => {
            onChange({ ...line, articleId: event.target.value });
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
        Cantidad
        <input
          className={fieldClassName}
          min="0.01"
          step="0.01"
          type="number"
          value={line.quantity}
          onChange={(event) => {
            onChange({ ...line, quantity: event.target.value });
          }}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Costo
        <input
          className={fieldClassName}
          min="0"
          step="0.01"
          type="number"
          value={line.unitCost}
          onChange={(event) => {
            onChange({ ...line, unitCost: event.target.value });
          }}
        />
      </label>
      <div>
        <p className="text-xs text-muted-foreground">Subtotal</p>
        <p className="mt-2 h-10 text-sm font-semibold">
          {formatMoney(lineTotal)}
        </p>
      </div>
      <Button
        aria-label="Quitar producto"
        disabled={!canRemove}
        size="icon"
        type="button"
        variant="outline"
        onClick={onRemove}
      >
        <Minus aria-hidden="true" className="h-4 w-4" />
      </Button>
    </div>
  );
}

function PurchaseOrdersList({
  orders,
  onStatusChange
}: {
  orders: PurchaseOrder[];
  onStatusChange(
    this: void,
    order: PurchaseOrder,
    status: Exclude<PurchaseOrderStatus, "draft">
  ): void;
}) {
  if (orders.length === 0) {
    return (
      <EmptyState
        title="Sin ordenes de compra"
        message="Todavia no registraste compras a proveedores."
      />
    );
  }

  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold">Ordenes registradas</h2>
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card shadow-sm md:block">
        <table className="w-full min-w-[1080px] border-collapse text-sm">
          <thead className="bg-muted/70 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Orden</th>
              <th className="px-4 py-3 font-medium">Proveedor</th>
              <th className="px-4 py-3 font-medium">Productos</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Entrega</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <p className="font-medium">{order.orderNumber}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(order.createdAt)}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{order.supplierName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {order.supplierContact || order.paymentTerms || "-"}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <OrderItemsSummary items={order.items} />
                </td>
                <td className="px-4 py-3 font-semibold">
                  {formatMoney(order.totalAmount)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {order.expectedDate ? formatShortDate(order.expectedDate) : "-"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.status} />
                </td>
                <td className="px-4 py-3">
                  <StatusActions order={order} onChange={onStatusChange} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {orders.map((order) => (
          <article
            key={order.id}
            className="rounded-lg border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {order.orderNumber}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {order.supplierName} - {formatDate(order.createdAt)}
                </p>
              </div>
              <StatusBadge status={order.status} />
            </div>
            <div className="mt-4">
              <OrderItemsSummary items={order.items} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Entrega</dt>
                <dd className="font-medium">
                  {order.expectedDate ? formatShortDate(order.expectedDate) : "-"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Total</dt>
                <dd className="font-semibold">{formatMoney(order.totalAmount)}</dd>
              </div>
            </dl>
            <div className="mt-4">
              <StatusActions order={order} onChange={onStatusChange} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function OrderItemsSummary({ items }: { items: PurchaseOrder["items"] }) {
  return (
    <div className="grid gap-1">
      {items.map((item) => (
        <p key={item.id} className="text-sm">
          <span className="font-medium">{item.articleName}</span>{" "}
          <span className="text-muted-foreground">
            x {formatQuantity(item.quantity)} - {formatMoney(item.lineTotal)}
          </span>
        </p>
      ))}
    </div>
  );
}

function StatusActions({
  order,
  onChange
}: {
  order: PurchaseOrder;
  onChange(
    this: void,
    order: PurchaseOrder,
    status: Exclude<PurchaseOrderStatus, "draft">
  ): void;
}) {
  const isClosed = order.status === "received" || order.status === "cancelled";

  if (isClosed) {
    return (
      <span className="text-sm text-muted-foreground">
        {order.inventoryPostedAt ? "Stock actualizado" : "Sin acciones"}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {order.status === "draft" ? (
        <Button
          size="sm"
          type="button"
          variant="outline"
          onClick={() => onChange(order, "sent")}
        >
          <Send aria-hidden="true" className="mr-2 h-4 w-4" />
          Enviar
        </Button>
      ) : null}
      <Button
        size="sm"
        type="button"
        variant="outline"
        onClick={() => onChange(order, "received")}
      >
        <CheckCircle2 aria-hidden="true" className="mr-2 h-4 w-4" />
        Recibir
      </Button>
      <Button
        size="sm"
        type="button"
        variant="outline"
        onClick={() => onChange(order, "cancelled")}
      >
        <XCircle aria-hidden="true" className="mr-2 h-4 w-4" />
        Cancelar
      </Button>
    </div>
  );
}

function StatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const styles = {
    draft: {
      className: "bg-muted text-muted-foreground",
      icon: Clock3,
      label: "Borrador"
    },
    sent: {
      className: "bg-primary text-primary-foreground",
      icon: Send,
      label: "Enviada"
    },
    received: {
      className: "bg-success text-success-foreground",
      icon: CheckCircle2,
      label: "Recibida"
    },
    cancelled: {
      className: "bg-destructive text-destructive-foreground",
      icon: XCircle,
      label: "Cancelada"
    }
  } satisfies Record<
    PurchaseOrderStatus,
    { className: string; icon: typeof Clock3; label: string }
  >;
  const style = styles[status];
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

function parseOrderDraft(draft: OrderDraft): PurchaseOrderInput | null {
  const supplierName = draft.supplierName.trim();
  const items = draft.items
    .map((item) => ({
      articleId: item.articleId.trim(),
      quantity: Number(item.quantity),
      unitCost: Number(item.unitCost),
      notes: item.notes.trim()
    }))
    .filter((item) => item.articleId);

  if (
    !supplierName ||
    items.length === 0 ||
    items.some(
      (item) =>
        !Number.isFinite(item.quantity) ||
        !Number.isFinite(item.unitCost) ||
        item.quantity <= 0 ||
        item.unitCost < 0
    )
  ) {
    return null;
  }

  return {
    supplierName,
    status: draft.status,
    ...(draft.supplierContact.trim()
      ? { supplierContact: draft.supplierContact.trim() }
      : {}),
    ...(draft.expectedDate.trim() ? { expectedDate: draft.expectedDate } : {}),
    ...(draft.paymentTerms.trim()
      ? { paymentTerms: draft.paymentTerms.trim() }
      : {}),
    ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
    items: items.map((item) => ({
      articleId: item.articleId,
      quantity: item.quantity,
      unitCost: item.unitCost,
      ...(item.notes ? { notes: item.notes } : {})
    }))
  };
}

function readDraftStatus(value: string): OrderDraft["status"] {
  if (value === "sent" || value === "received") {
    return value;
  }

  return "draft";
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS"
  }).format(value);
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

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short"
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function getPurchaseOrderErrorMessage(error: unknown) {
  if (error instanceof Error && error.message === "Invalid article.") {
    return "La orden tiene un producto invalido.";
  }

  if (error instanceof Error && error.message === "Status is closed.") {
    return "La orden ya esta cerrada y no puede cambiar de estado.";
  }

  return "No se pudo guardar la orden de compra.";
}

const fieldClassName =
  "h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
