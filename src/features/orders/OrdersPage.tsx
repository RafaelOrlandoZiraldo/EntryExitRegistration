import {
  ClipboardCheck,
  Minus,
  PackagePlus,
  ShoppingCart
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { InventoryItem, InventorySnapshot } from "@app/services/inventory";
import type {
  Order,
  OrderInput,
  OrderStatus,
  OrdersSnapshot
} from "@app/services/orders";
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageTitle,
  useToast
} from "@shared/ui";

interface OrdersPageProps {
  inventoryService: {
    list(this: void): Promise<InventorySnapshot>;
  };
  ordersService: {
    list(this: void): Promise<OrdersSnapshot>;
    create(this: void, input: OrderInput): Promise<Order>;
    updateStatus(this: void, id: string, status: OrderStatus): Promise<Order>;
  };
}

interface OrderDraftLine {
  articleId: string;
  quantity: string;
}

interface OrderDraft {
  customerName: string;
  status: OrderStatus;
  paymentMethod: string;
  notes: string;
  items: OrderDraftLine[];
}

type LoadState =
  | { status: "loading" }
  | { status: "success"; inventory: InventorySnapshot; orders: Order[] }
  | { status: "error"; error: string };

const emptyDraft: OrderDraft = {
  customerName: "",
  status: "confirmed",
  paymentMethod: "cash",
  notes: "",
  items: [{ articleId: "", quantity: "1" }]
};

export function OrdersPage({ inventoryService, ordersService }: OrdersPageProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [draft, setDraft] = useState<OrderDraft>(emptyDraft);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { notify } = useToast();

  const loadOrders = useCallback(() => {
    setState({ status: "loading" });
    void Promise.all([inventoryService.list(), ordersService.list()])
      .then(([inventory, ordersSnapshot]) => {
        setState({
          status: "success",
          inventory,
          orders: ordersSnapshot.orders
        });
        setDraft((current) => ({
          ...current,
          items: current.items.map((item) => ({
            ...item,
            articleId: item.articleId || inventory.items[0]?.articleId || ""
          }))
        }));
      })
      .catch(() => {
        setState({
          status: "error",
          error: "No se pudieron cargar los pedidos."
        });
      });
  }, [inventoryService, ordersService]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const items = useMemo(
    () => (state.status === "success" ? state.inventory.items : []),
    [state]
  );
  const orders = useMemo(
    () => (state.status === "success" ? state.orders : []),
    [state]
  );
  const sellableItems = useMemo(
    () =>
      items.filter(
        (item) =>
          item.active &&
          item.quantity > 0 &&
          typeof item.price === "number" &&
          item.price > 0
      ),
    [items]
  );
  const articleById = useMemo(
    () => new Map(items.map((item) => [item.articleId, item])),
    [items]
  );
  const draftTotal = useMemo(
    () =>
      draft.items.reduce((total, line) => {
        const item = articleById.get(line.articleId);
        const quantity = Number(line.quantity);

        if (!item || typeof item.price !== "number" || !Number.isFinite(quantity)) {
          return total;
        }

        return total + item.price * quantity;
      }, 0),
    [articleById, draft.items]
  );

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const input = parseOrderDraft(draft);

    if (!input) {
      notify({
        type: "warning",
        message: "Carga cliente, medio de pago y al menos un producto valido."
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await ordersService.create(input);
      notify({ type: "success", message: "Pedido generado correctamente." });
      setDraft({
        ...emptyDraft,
        items: [{ articleId: sellableItems[0]?.articleId || "", quantity: "1" }]
      });
      loadOrders();
    } catch (error) {
      notify({ type: "error", message: getOrderErrorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStatus = useCallback(
    (order: Order, status: OrderStatus) => {
      void ordersService
        .updateStatus(order.id, status)
        .then(() => {
          notify({ type: "success", message: "Estado actualizado." });
          loadOrders();
        })
        .catch(() => {
          notify({
            type: "error",
            message: "No se pudo actualizar el estado del pedido."
          });
        });
    },
    [loadOrders, notify, ordersService]
  );

  return (
    <section className="grid gap-6">
      <PageTitle
        eyebrow="Pedidos"
        title="Generacion de pedidos"
        description="Carga productos del catalogo, registra la venta y descuenta stock automaticamente."
      />

      {state.status === "loading" ? (
        <LoadingState title="Cargando pedidos" />
      ) : null}

      {state.status === "error" ? (
        <ErrorState
          title="No se pudo cargar"
          message={state.error}
          actionLabel="Reintentar"
          onAction={loadOrders}
        />
      ) : null}

      {state.status === "success" ? (
        <>
          <OrdersSummary orders={orders} />

          <OrderForm
            draft={draft}
            disabled={isSubmitting || sellableItems.length === 0}
            items={sellableItems}
            total={draftTotal}
            onChange={setDraft}
            onSubmit={(event) => {
              void submitOrder(event);
            }}
          />

          <OrdersList orders={orders} onStatusChange={updateStatus} />
        </>
      ) : null}
    </section>
  );
}

function OrderForm({
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
  onSubmit(this: void, event: FormEvent<HTMLFormElement>): void;
}) {
  return (
    <form
      className="grid gap-4 rounded-lg border border-border bg-card p-4 shadow-sm"
      onSubmit={onSubmit}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <ShoppingCart aria-hidden="true" className="h-4 w-4 text-primary" />
            Nuevo pedido
          </h2>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-2xl font-semibold">{formatMoney(total)}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-border bg-muted/60 p-3 text-sm text-muted-foreground">
          Para generar pedidos necesitas productos activos, con precio y stock.
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[1.4fr_12rem_12rem]">
        <label className="grid gap-2 text-sm font-medium">
          Cliente
          <input
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={draft.customerName}
            onChange={(event) => {
              onChange({ ...draft, customerName: event.target.value });
            }}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Estado
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={draft.status}
            onChange={(event) => {
              onChange({
                ...draft,
                status: readOrderStatus(event.target.value)
              });
            }}
          >
            <option value="pending">Pendiente</option>
            <option value="confirmed">Confirmado</option>
            <option value="delivered">Entregado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Pago
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={draft.paymentMethod}
            onChange={(event) => {
              onChange({ ...draft, paymentMethod: event.target.value });
            }}
          >
            <option value="cash">Efectivo</option>
            <option value="debit_card">Tarjeta de debito</option>
            <option value="credit_card">Tarjeta de credito</option>
            <option value="bank_transfer">Transferencia</option>
            <option value="digital_wallet">Billetera digital</option>
            <option value="other">Otro</option>
          </select>
        </label>
      </div>

      <div className="grid gap-3">
        {draft.items.map((line, index) => (
          <OrderLineEditor
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
                { articleId: items[0]?.articleId || "", quantity: "1" }
              ]
            });
          }}
        >
          <PackagePlus aria-hidden="true" className="mr-2 h-4 w-4" />
          Producto
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Al generar el pedido se registra la venta y se descuenta el stock.
        </p>
        <Button disabled={disabled} type="submit">
          <ClipboardCheck aria-hidden="true" className="mr-2 h-4 w-4" />
          Generar pedido
        </Button>
      </div>
    </form>
  );
}

function OrderLineEditor({
  canRemove,
  items,
  line,
  onChange,
  onRemove
}: {
  canRemove: boolean;
  items: InventoryItem[];
  line: OrderDraftLine;
  onChange(this: void, line: OrderDraftLine): void;
  onRemove(this: void): void;
}) {
  const item = items.find((candidate) => candidate.articleId === line.articleId);
  const quantity = Number(line.quantity);
  const lineTotal =
    item && typeof item.price === "number" && Number.isFinite(quantity)
      ? item.price * quantity
      : 0;

  return (
    <div className="grid gap-3 rounded-md border border-border bg-background p-3 md:grid-cols-[1.5fr_9rem_8rem_8rem_auto] md:items-end">
      <label className="grid gap-2 text-sm font-medium">
        Producto
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={line.articleId}
          onChange={(event) => {
            onChange({ ...line, articleId: event.target.value });
          }}
        >
          <option value="">Seleccionar</option>
          {items.map((candidate) => (
            <option key={candidate.articleId} value={candidate.articleId}>
              {candidate.articleName}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2 text-sm font-medium">
        Cantidad
        <input
          className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          min="0.01"
          step="0.01"
          type="number"
          value={line.quantity}
          onChange={(event) => {
            onChange({ ...line, quantity: event.target.value });
          }}
        />
      </label>

      <div>
        <p className="text-xs text-muted-foreground">Disponible</p>
        <p className="mt-2 h-10 text-sm font-medium">
          {item ? formatQuantity(item.quantity) : "-"}
        </p>
      </div>

      <div>
        <p className="text-xs text-muted-foreground">Importe</p>
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

function OrdersSummary({ orders }: { orders: Order[] }) {
  const delivered = orders.filter((order) => order.status === "delivered").length;
  const totalAmount = orders.reduce((total, order) => total + order.totalAmount, 0);

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <SummaryTile label="Pedidos" value={orders.length} />
      <SummaryTile label="Entregados" value={delivered} />
      <SummaryTile label="Ventas" value={formatMoney(totalAmount)} />
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

function OrdersList({
  orders,
  onStatusChange
}: {
  orders: Order[];
  onStatusChange(this: void, order: Order, status: OrderStatus): void;
}) {
  if (orders.length === 0) {
    return (
      <EmptyState
        title="Sin pedidos"
        message="Todavia no hay pedidos generados."
      />
    );
  }

  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-semibold">Pedidos generados</h2>
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card shadow-sm md:block">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead className="bg-muted/70 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Pedido</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Productos</th>
              <th className="px-4 py-3 font-medium">Pago</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Estado</th>
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
                <td className="px-4 py-3">{order.customerName}</td>
                <td className="px-4 py-3">
                  <OrderItemsSummary items={order.items} />
                </td>
                <td className="px-4 py-3">
                  {formatPaymentMethod(order.paymentMethod)}
                </td>
                <td className="px-4 py-3 font-semibold">
                  {formatMoney(order.totalAmount)}
                </td>
                <td className="px-4 py-3">
                  <StatusControl order={order} onChange={onStatusChange} />
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
                  {order.customerName} - {formatDate(order.createdAt)}
                </p>
              </div>
              <StatusBadge status={order.status} />
            </div>
            <div className="mt-4">
              <OrderItemsSummary items={order.items} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Pago</dt>
                <dd className="font-medium">
                  {formatPaymentMethod(order.paymentMethod)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Total</dt>
                <dd className="font-semibold">{formatMoney(order.totalAmount)}</dd>
              </div>
            </dl>
            <div className="mt-4">
              <StatusControl order={order} onChange={onStatusChange} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function OrderItemsSummary({ items }: { items: Order["items"] }) {
  return (
    <div className="grid gap-1">
      {items.map((item) => (
        <p key={item.id} className="text-sm">
          <span className="font-medium">{item.articleName}</span>{" "}
          <span className="text-muted-foreground">
            x {formatQuantity(item.quantity)}
          </span>
        </p>
      ))}
    </div>
  );
}

function StatusControl({
  order,
  onChange
}: {
  order: Order;
  onChange(this: void, order: Order, status: OrderStatus): void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge status={order.status} />
      <select
        className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={order.status}
        onChange={(event) => {
          onChange(order, readOrderStatus(event.target.value));
        }}
      >
        <option value="pending">Pendiente</option>
        <option value="confirmed">Confirmado</option>
        <option value="delivered">Entregado</option>
        <option value="cancelled">Cancelado</option>
      </select>
    </div>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const styles = {
    pending: "bg-warning text-warning-foreground",
    confirmed: "bg-primary text-primary-foreground",
    delivered: "bg-success text-success-foreground",
    cancelled: "bg-muted text-muted-foreground"
  } satisfies Record<OrderStatus, string>;

  return (
    <span
      className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${styles[status]}`}
    >
      {formatStatus(status)}
    </span>
  );
}

function parseOrderDraft(draft: OrderDraft): OrderInput | null {
  const customerName = draft.customerName.trim();
  const paymentMethod = draft.paymentMethod.trim();
  const items = draft.items
    .map((item) => ({
      articleId: item.articleId.trim(),
      quantity: Number(item.quantity)
    }))
    .filter((item) => item.articleId);

  if (
    !customerName ||
    !paymentMethod ||
    !isPaymentMethod(paymentMethod) ||
    items.length === 0 ||
    items.some(
      (item) => !Number.isFinite(item.quantity) || item.quantity <= 0
    )
  ) {
    return null;
  }

  return {
    customerName,
    status: draft.status,
    paymentMethod,
    items,
    ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {})
  };
}

function readOrderStatus(value: string): OrderStatus {
  if (
    value === "pending" ||
    value === "delivered" ||
    value === "cancelled"
  ) {
    return value;
  }

  return "confirmed";
}

function isPaymentMethod(value: string) {
  return (
    value === "cash" ||
    value === "debit_card" ||
    value === "credit_card" ||
    value === "bank_transfer" ||
    value === "digital_wallet" ||
    value === "other"
  );
}

function formatStatus(status: OrderStatus) {
  const labels = {
    pending: "Pendiente",
    confirmed: "Confirmado",
    delivered: "Entregado",
    cancelled: "Cancelado"
  } satisfies Record<OrderStatus, string>;

  return labels[status];
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS"
  }).format(value);
}

function formatPaymentMethod(value: string) {
  const labels: Record<string, string> = {
    cash: "Efectivo",
    debit_card: "Tarjeta de debito",
    credit_card: "Tarjeta de credito",
    bank_transfer: "Transferencia",
    digital_wallet: "Billetera digital",
    other: "Otro"
  };

  return labels[value] ?? value;
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

function getOrderErrorMessage(error: unknown) {
  if (error instanceof Error && error.message === "Insufficient stock.") {
    return "No hay stock suficiente para generar el pedido.";
  }

  if (error instanceof Error && error.message === "Missing price.") {
    return "Todos los productos del pedido necesitan precio en el catalogo.";
  }

  if (error instanceof Error && error.message === "Invalid article.") {
    return "El pedido tiene un producto invalido o inactivo.";
  }

  return "No se pudo generar el pedido.";
}
