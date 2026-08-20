import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  PackageCheck,
  ShoppingCart,
  WalletCards,
  type LucideIcon
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CatalogSnapshot } from "@app/services/catalog";
import type { InventorySnapshot } from "@app/services/inventory";
import type { Order, OrdersSnapshot, OrderStatus } from "@app/services/orders";
import {
  calculateFinancialSummary,
  type FinancialTransaction
} from "@domain/transactions";
import { Button, EmptyState, ErrorState, LoadingState, PageTitle } from "@shared/ui";

interface HomePageProps {
  catalogService: {
    list(this: void): Promise<CatalogSnapshot>;
  };
  inventoryService: {
    list(this: void): Promise<InventorySnapshot>;
  };
  ordersService: {
    list(this: void): Promise<OrdersSnapshot>;
  };
  getTransactionsUseCase: {
    execute(this: void): Promise<FinancialTransaction[]>;
  };
}

type LoadState =
  | { status: "loading" }
  | {
      status: "success";
      catalog: CatalogSnapshot;
      inventory: InventorySnapshot;
      orders: Order[];
      transactions: FinancialTransaction[];
    }
  | { status: "error"; error: string };

const chartColors = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--accent))",
  "hsl(var(--secondary-foreground))"
];

const statusLabels = {
  pending: "Pendientes",
  confirmed: "Confirmados",
  delivered: "Entregados",
  cancelled: "Cancelados"
} satisfies Record<OrderStatus, string>;

export function HomePage({
  catalogService,
  inventoryService,
  ordersService,
  getTransactionsUseCase
}: HomePageProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const loadDashboard = useCallback(() => {
    setState({ status: "loading" });
    void Promise.all([
      catalogService.list(),
      inventoryService.list(),
      ordersService.list(),
      getTransactionsUseCase.execute()
    ])
      .then(([catalog, inventory, ordersSnapshot, transactions]) => {
        setState({
          status: "success",
          catalog,
          inventory,
          orders: ordersSnapshot.orders,
          transactions
        });
      })
      .catch(() => {
        setState({
          status: "error",
          error: "No se pudo cargar la informacion del dashboard."
        });
      });
  }, [catalogService, getTransactionsUseCase, inventoryService, ordersService]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <section className="grid gap-6">
      <PageTitle
        eyebrow="Panel principal"
        title="Dashboard general"
        description="Resumen operativo de movimientos, ventas, pedidos, catalogo e inventario."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/orders">Nuevo pedido</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/inventory">Ver inventario</Link>
            </Button>
          </div>
        }
      />

      {state.status === "loading" ? (
        <LoadingState title="Cargando dashboard" />
      ) : null}

      {state.status === "error" ? (
        <ErrorState
          title="No se pudo cargar"
          message={state.error}
          actionLabel="Reintentar"
          onAction={loadDashboard}
        />
      ) : null}

      {state.status === "success" ? (
        <DashboardContent
          catalog={state.catalog}
          inventory={state.inventory}
          orders={state.orders}
          transactions={state.transactions}
        />
      ) : null}
    </section>
  );
}

function DashboardContent({
  catalog,
  inventory,
  orders,
  transactions
}: {
  catalog: CatalogSnapshot;
  inventory: InventorySnapshot;
  orders: Order[];
  transactions: FinancialTransaction[];
}) {
  const summary = useMemo(
    () => createDashboardSummary(catalog, inventory, orders, transactions),
    [catalog, inventory, orders, transactions]
  );
  const monthlyData = useMemo(
    () => createMonthlyData(transactions, orders),
    [orders, transactions]
  );
  const orderStatusData = useMemo(() => createOrderStatusData(orders), [orders]);
  const stockStatusData = useMemo(
    () => createStockStatusData(inventory),
    [inventory]
  );
  const topProducts = useMemo(() => createTopProductsData(orders), [orders]);

  if (
    catalog.categories.length === 0 &&
    catalog.articles.length === 0 &&
    inventory.items.length === 0 &&
    orders.length === 0 &&
    transactions.length === 0
  ) {
    return (
      <EmptyState
        title="Sin informacion cargada"
        message="Cuando cargues catalogo, stock, pedidos o movimientos, el resumen va a aparecer aca."
      />
    );
  }

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail={`${summary.orderCount} pedidos registrados`}
          icon={ShoppingCart}
          label="Ventas por pedidos"
          value={formatMoney(summary.orderSales)}
        />
        <MetricCard
          detail={`${summary.transactionCount} movimientos`}
          icon={WalletCards}
          label="Balance financiero"
          value={formatMoney(summary.balance)}
        />
        <MetricCard
          detail={`${summary.articleCount} productos en catalogo`}
          icon={Boxes}
          label="Valor estimado stock"
          value={formatMoney(summary.stockValue)}
        />
        <MetricCard
          detail={`${summary.outOfStockCount} sin stock`}
          icon={AlertTriangle}
          label="Productos bajos"
          value={String(summary.lowStockCount)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <ChartPanel
          title="Evolucion mensual"
          description="Ingresos, egresos y ventas de pedidos por mes."
        >
          {monthlyData.length > 0 ? (
            <div className="h-[320px]">
              <ResponsiveContainer height="100%" width="100%">
                <AreaChart data={monthlyData} margin={{ left: 4, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} />
                  <YAxis tickFormatter={formatCompactMoney} width={72} />
                  <Tooltip formatter={(value) => formatMoney(Number(value))} />
                  <Area
                    dataKey="income"
                    fill="hsl(var(--success))"
                    fillOpacity={0.16}
                    name="Ingresos"
                    stroke="hsl(var(--success))"
                    strokeWidth={2}
                  />
                  <Area
                    dataKey="expenses"
                    fill="hsl(var(--destructive))"
                    fillOpacity={0.12}
                    name="Egresos"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2}
                  />
                  <Area
                    dataKey="sales"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.12}
                    name="Ventas pedidos"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmpty message="No hay movimientos con fecha para graficar." />
          )}
        </ChartPanel>

        <ChartPanel
          title="Estado de pedidos"
          description="Distribucion actual de pedidos por estado."
        >
          {orders.length > 0 ? (
            <div className="h-[320px]">
              <ResponsiveContainer height="100%" width="100%">
                <PieChart>
                  <Pie
                    data={orderStatusData}
                    dataKey="value"
                    innerRadius={66}
                    nameKey="label"
                    outerRadius={104}
                    paddingAngle={2}
                  >
                    {orderStatusData.map((entry, index) => (
                      <Cell
                        fill={chartColors[index % chartColors.length]}
                        key={entry.status}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => String(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmpty message="Todavia no hay pedidos cargados." />
          )}
          <LegendList
            items={orderStatusData.map((entry, index) => ({
              color: chartColors[index % chartColors.length],
              label: entry.label,
              value: String(entry.value)
            }))}
          />
        </ChartPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartPanel
          title="Productos mas vendidos"
          description="Cantidad vendida segun los pedidos registrados."
        >
          {topProducts.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer height="100%" width="100%">
                <BarChart data={topProducts} layout="vertical" margin={{ left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickLine={false} />
                  <YAxis
                    dataKey="name"
                    tickLine={false}
                    type="category"
                    width={120}
                  />
                  <Tooltip formatter={(value) => formatQuantity(Number(value))} />
                  <Bar dataKey="quantity" fill="hsl(var(--primary))" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmpty message="No hay productos vendidos todavia." />
          )}
        </ChartPanel>

        <ChartPanel
          title="Salud del stock"
          description="Productos con stock disponible, bajo o agotado."
        >
          {inventory.items.length > 0 ? (
            <div className="h-[300px]">
              <ResponsiveContainer height="100%" width="100%">
                <BarChart data={stockStatusData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} />
                  <Tooltip formatter={(value) => String(value)} />
                  <Bar dataKey="value" radius={4}>
                    {stockStatusData.map((entry, index) => (
                      <Cell
                        fill={chartColors[index % chartColors.length]}
                        key={entry.key}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmpty message="No hay productos en inventario." />
          )}
        </ChartPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <OrdersOverview orders={orders} />
        <InventoryOverview inventory={inventory} />
      </div>
    </>
  );
}

function MetricCard({
  detail,
  icon: Icon,
  label,
  value
}: {
  detail: string;
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-normal">{value}</p>
        </div>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground">
          <Icon aria-hidden="true" className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

function ChartPanel({
  children,
  description,
  title
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="grid gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="grid min-h-[220px] place-items-center rounded-md border border-dashed border-border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function LegendList({
  items
}: {
  items: Array<{ color: string; label: string; value: string }>;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul className="grid gap-2">
      {items.map((item) => (
        <li
          className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm"
          key={item.label}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            <span className="truncate">{item.label}</span>
          </span>
          <span className="font-semibold">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}

function OrdersOverview({ orders }: { orders: Order[] }) {
  const latestOrders = orders.slice(0, 5);

  return (
    <section className="grid gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <ClipboardList aria-hidden="true" className="h-4 w-4 text-primary" />
          Ultimos pedidos
        </h2>
        <Button asChild size="sm" variant="outline">
          <Link to="/orders">Ver todos</Link>
        </Button>
      </div>

      {latestOrders.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead className="border-b border-border text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">Pedido</th>
                <th className="py-2 pr-3 font-medium">Cliente</th>
                <th className="py-2 pr-3 font-medium">Estado</th>
                <th className="py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {latestOrders.map((order) => (
                <tr key={order.id} className="border-b border-border last:border-0">
                  <td className="py-3 pr-3 font-medium">{order.orderNumber}</td>
                  <td className="py-3 pr-3">{order.customerName}</td>
                  <td className="py-3 pr-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="py-3 text-right font-semibold">
                    {formatMoney(order.totalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ChartEmpty message="Todavia no hay pedidos generados." />
      )}
    </section>
  );
}

function InventoryOverview({ inventory }: { inventory: InventorySnapshot }) {
  const criticalItems = inventory.items
    .filter((item) => item.quantity <= 5)
    .sort((left, right) => left.quantity - right.quantity)
    .slice(0, 6);

  return (
    <section className="grid gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <PackageCheck aria-hidden="true" className="h-4 w-4 text-primary" />
          Stock a revisar
        </h2>
        <Button asChild size="sm" variant="outline">
          <Link to="/inventory">Ver stock</Link>
        </Button>
      </div>

      {criticalItems.length > 0 ? (
        <div className="grid gap-2">
          {criticalItems.map((item) => (
            <div
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3 text-sm"
              key={item.articleId}
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{item.articleName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.categoryName}
                </p>
              </div>
              <span className="shrink-0 font-semibold">
                {formatQuantity(item.quantity)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <ChartEmpty message="No hay productos con stock bajo." />
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const styles = {
    pending: "bg-warning text-warning-foreground",
    confirmed: "bg-primary text-primary-foreground",
    delivered: "bg-success text-success-foreground",
    cancelled: "bg-muted text-muted-foreground"
  } satisfies Record<OrderStatus, string>;
  const singularLabels = {
    pending: "Pendiente",
    confirmed: "Confirmado",
    delivered: "Entregado",
    cancelled: "Cancelado"
  } satisfies Record<OrderStatus, string>;

  return (
    <span
      className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${styles[status]}`}
    >
      {singularLabels[status]}
    </span>
  );
}

function createDashboardSummary(
  catalog: CatalogSnapshot,
  inventory: InventorySnapshot,
  orders: Order[],
  transactions: FinancialTransaction[]
) {
  const financial = calculateFinancialSummary(transactions);
  const orderSales = orders.reduce((total, order) => total + order.totalAmount, 0);
  const stockValue = inventory.items.reduce((total, item) => {
    const price = typeof item.price === "number" ? item.price : 0;
    return total + price * item.quantity;
  }, 0);
  const lowStockCount = inventory.items.filter(
    (item) => item.quantity > 0 && item.quantity <= 5
  ).length;
  const outOfStockCount = inventory.items.filter((item) => item.quantity <= 0).length;

  return {
    articleCount: catalog.articles.length,
    balance: financial.balance,
    lowStockCount,
    orderCount: orders.length,
    orderSales,
    outOfStockCount,
    stockValue,
    transactionCount: financial.transactionCount
  };
}

function createMonthlyData(
  transactions: FinancialTransaction[],
  orders: Order[]
) {
  const rows = createRecentMonthLabels(6).map((entry) => ({
    key: entry.key,
    label: entry.label,
    income: 0,
    expenses: 0,
    sales: 0
  }));
  const rowByKey = new Map(rows.map((row) => [row.key, row]));

  for (const transaction of transactions) {
    const row = rowByKey.get(transaction.date.slice(0, 7));

    if (!row) {
      continue;
    }

    if (transaction.type === "income") {
      row.income += transaction.amount;
    } else {
      row.expenses += transaction.amount;
    }
  }

  for (const order of orders) {
    const row = rowByKey.get(order.createdAt.slice(0, 7));

    if (row) {
      row.sales += order.totalAmount;
    }
  }

  return rows.filter(
    (row) => row.income > 0 || row.expenses > 0 || row.sales > 0
  );
}

function createRecentMonthLabels(count: number) {
  const now = new Date();

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - (count - index - 1),
      1
    );
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
    const label = new Intl.DateTimeFormat("es-AR", {
      month: "short"
    }).format(date);

    return { key, label };
  });
}

function createOrderStatusData(orders: Order[]) {
  const counts = orders.reduce<Record<OrderStatus, number>>(
    (current, order) => {
      current[order.status] += 1;
      return current;
    },
    {
      pending: 0,
      confirmed: 0,
      delivered: 0,
      cancelled: 0
    }
  );

  return Object.entries(counts)
    .map(([status, value]) => ({
      status: status as OrderStatus,
      label: statusLabels[status as OrderStatus],
      value
    }))
    .filter((entry) => entry.value > 0);
}

function createStockStatusData(inventory: InventorySnapshot) {
  const available = inventory.items.filter((item) => item.quantity > 5).length;
  const low = inventory.items.filter(
    (item) => item.quantity > 0 && item.quantity <= 5
  ).length;
  const out = inventory.items.filter((item) => item.quantity <= 0).length;

  return [
    { key: "available", label: "Disponible", value: available },
    { key: "low", label: "Bajo", value: low },
    { key: "out", label: "Sin stock", value: out }
  ];
}

function createTopProductsData(orders: Order[]) {
  const quantityByProduct = new Map<string, number>();

  for (const order of orders) {
    for (const item of order.items) {
      quantityByProduct.set(
        item.articleName,
        (quantityByProduct.get(item.articleName) ?? 0) + item.quantity
      );
    }
  }

  return Array.from(quantityByProduct.entries())
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((left, right) => right.quantity - left.quantity)
    .slice(0, 6);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS"
  }).format(value);
}

function formatCompactMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 2
  }).format(value);
}
