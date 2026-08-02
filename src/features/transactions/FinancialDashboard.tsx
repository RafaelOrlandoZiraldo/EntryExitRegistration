import {
  Cell,
  Pie,
  PieChart,
  Tooltip
} from "recharts";
import { ArrowUpRight, ChevronLeft } from "lucide-react";
import { useMemo, useState } from "react";
import {
  calculateFinancialSummary,
  type ExpenseCategoryGroup,
  type FinancialSummary,
  type FinancialTransaction
} from "@domain/transactions";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  TransactionTypeBadge
} from "@shared/ui";
import {
  formatTransactionAmount,
  formatTransactionDate,
  getCategoryLabel,
  getPaymentMethodLabel
} from "./formatters";

export interface FinancialDashboardProps {
  summary: FinancialSummary;
  expenseDistribution: ExpenseCategoryGroup[];
  transactions: readonly FinancialTransaction[];
}

const chartColors = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--destructive))",
  "hsl(var(--secondary-foreground))"
];

const percentFormatter = new Intl.NumberFormat("es-AR", {
  maximumFractionDigits: 1,
  style: "percent"
});

export function FinancialDashboard({
  summary,
  expenseDistribution,
  transactions
}: FinancialDashboardProps) {
  const balanceState =
    summary.balance > 0
      ? "Resultado positivo"
      : summary.balance < 0
        ? "Resultado negativo"
        : "Resultado en cero";

  return (
    <section aria-labelledby="dashboard-title" className="grid gap-4">
      <div>
        <h2 id="dashboard-title" className="text-lg font-semibold">
          Indicadores financieros
        </h2>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total ingresos"
          value={formatTransactionAmount(summary.income)}
          detail="Ingresos visibles"
        />
        <SummaryCard
          label="Total egresos"
          value={formatTransactionAmount(summary.expenses)}
          detail="Egresos visibles"
        />
        <SummaryCard
          label="Balance"
          value={formatTransactionAmount(summary.balance)}
          detail={balanceState}
        />
        <SummaryCard
          label="Movimientos"
          value={String(summary.transactionCount)}
          detail="Cantidad visible"
        />
      </dl>

      <FinancialHistory transactions={transactions} />

      <section
        aria-labelledby="expense-distribution-title"
        className="grid gap-4 rounded-lg border border-border bg-card p-4 shadow-sm lg:grid-cols-[minmax(260px,380px)_1fr]"
      >
        <div className="min-h-[260px]">
          <h3 id="expense-distribution-title" className="text-base font-semibold">
            Egresos por categoria
          </h3>
          {expenseDistribution.length > 0 ? (
            <div
              aria-hidden="true"
              className="mt-3 flex h-[220px] w-full min-w-[240px] justify-center overflow-hidden"
              data-testid="expense-distribution-chart"
            >
              <PieChart height={220} width={320}>
                <Pie
                  data={expenseDistribution}
                  dataKey="amount"
                  innerRadius={52}
                  nameKey="label"
                  outerRadius={86}
                  paddingAngle={2}
                >
                  {expenseDistribution.map((entry, index) => (
                    <Cell
                      fill={chartColors[index % chartColors.length]}
                      key={entry.category}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatTransactionAmount(Number(value))}
                />
              </PieChart>
            </div>
          ) : (
            <div className="mt-3 flex min-h-[220px] items-center rounded-md border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              No hay egresos visibles para graficar.
            </div>
          )}
        </div>

        <div>
          <p className="text-sm text-muted-foreground">
            Distribucion calculada sobre egresos visibles.
          </p>
          {expenseDistribution.length > 0 ? (
            <ul className="mt-4 grid gap-3">
              {expenseDistribution.map((entry, index) => (
                <li
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3 text-sm"
                  key={entry.category}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 shrink-0 rounded-sm"
                      style={{
                        backgroundColor: chartColors[index % chartColors.length]
                      }}
                    />
                    <span className="min-w-0 truncate font-medium">
                      {entry.label}
                    </span>
                  </div>
                  <span className="shrink-0 text-right">
                    {formatTransactionAmount(entry.amount)} -{" "}
                    {percentFormatter.format(entry.proportion)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 rounded-md border border-border bg-background p-3 text-sm">
              El total de egresos visible es {formatTransactionAmount(0)}.
            </p>
          )}
        </div>
      </section>
    </section>
  );
}

interface YearSummary {
  year: string;
  summary: FinancialSummary;
  transactions: FinancialTransaction[];
}

interface MonthSummary {
  monthIndex: number;
  label: string;
  summary: FinancialSummary;
  transactions: FinancialTransaction[];
}

const monthNames = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre"
];

function FinancialHistory({
  transactions
}: {
  transactions: readonly FinancialTransaction[];
}) {
  const [selectedYear, setSelectedYear] = useState<YearSummary | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<MonthSummary | null>(null);
  const [selectedTransaction, setSelectedTransaction] =
    useState<FinancialTransaction | null>(null);
  const years = useMemo(() => groupTransactionsByYear(transactions), [transactions]);
  const months = useMemo(
    () => (selectedYear ? createMonthSummaries(selectedYear.transactions) : []),
    [selectedYear]
  );

  if (years.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="financial-history-title" className="grid gap-3">
      <div>
        <h3 id="financial-history-title" className="text-base font-semibold">
          Historial de movimientos por año
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Resumen calculado sobre los movimientos visibles actualmente.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {years.map((year) => (
          <button
            key={year.year}
            className="rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
            onClick={() => {
              setSelectedYear(year);
            }}
          >
            <span className="flex items-center justify-between gap-3 text-base font-semibold">
              Historial {year.year}
              <ArrowUpRight
                aria-hidden="true"
                className="h-4 w-4 text-muted-foreground"
              />
            </span>
            <span className="mt-3 grid gap-2 text-sm text-muted-foreground">
              <MetricLine
                label="Total ingresos"
                value={formatTransactionAmount(year.summary.income)}
              />
              <MetricLine
                label="Total egresos"
                value={formatTransactionAmount(year.summary.expenses)}
              />
              <MetricLine
                label="Balance"
                strong
                value={formatTransactionAmount(year.summary.balance)}
              />
            </span>
          </button>
        ))}
      </div>

      <Dialog
        open={selectedYear !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedYear(null);
            setSelectedMonth(null);
            setSelectedTransaction(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {selectedYear ? `${selectedYear.year}: resumen mensual` : "Resumen mensual"}
            </DialogTitle>
            <DialogDescription>
              Los 12 meses del año con ingresos, egresos y balance visibles.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {months.map((month) => (
              <button
                key={month.monthIndex}
                className="rounded-lg border border-border bg-background p-4 text-left transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                type="button"
                onClick={() => {
                  setSelectedMonth(month);
                }}
              >
                <span className="flex items-center justify-between gap-3 text-sm font-semibold">
                  {month.label}
                  <ArrowUpRight
                    aria-hidden="true"
                    className="h-4 w-4 text-muted-foreground"
                  />
                </span>
                <span className="mt-2 grid gap-1 text-xs text-muted-foreground">
                  <MetricLine
                    label="Balance"
                    strong
                    value={formatTransactionAmount(month.summary.balance)}
                  />
                  <MetricLine
                    label="Movimientos"
                    value={String(month.summary.transactionCount)}
                  />
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedMonth !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMonth(null);
            setSelectedTransaction(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {selectedMonth && selectedYear
                ? `Movimientos de ${selectedMonth.label} ${selectedYear.year}`
                : "Movimientos del mes"}
            </DialogTitle>
            <DialogDescription>
              Selecciona un movimiento para abrir su ficha de detalle.
            </DialogDescription>
          </DialogHeader>

          <Button
            className="w-fit"
            type="button"
            variant="outline"
            onClick={() => {
              setSelectedMonth(null);
            }}
          >
            <ChevronLeft aria-hidden="true" className="mr-2 h-4 w-4" />
            Volver a meses
          </Button>

          {selectedMonth && selectedMonth.transactions.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead className="bg-muted/70 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Descripción</th>
                    <th className="px-4 py-3 font-medium">Categoría</th>
                    <th className="px-4 py-3 font-medium">Monto</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedMonth.transactions.map((transaction) => (
                    <tr
                      key={transaction.id}
                      className="border-t border-border transition-colors hover:bg-primary/5"
                    >
                      <td className="px-4 py-3">
                        {formatTransactionDate(transaction.date)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          className="inline-flex items-center gap-2 font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          type="button"
                          onClick={() => {
                            setSelectedTransaction(transaction);
                          }}
                        >
                          {transaction.description}
                          <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        {getCategoryLabel(transaction.category)}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {transaction.type === "income" ? "+" : "-"}
                        {formatTransactionAmount(transaction.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <TransactionTypeBadge type={transaction.type} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              No hay movimientos visibles para este mes.
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={selectedTransaction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTransaction(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle de la transacción</DialogTitle>
            <DialogDescription>
              Ficha del movimiento seleccionado.
            </DialogDescription>
          </DialogHeader>

          {selectedTransaction ? (
            <TransactionDetail transaction={selectedTransaction} />
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function MetricLine({
  label,
  value,
  strong = false
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <span className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className={strong ? "font-semibold text-foreground" : "text-foreground"}>
        {value}
      </span>
    </span>
  );
}

function TransactionDetail({
  transaction
}: {
  transaction: FinancialTransaction;
}) {
  return (
    <dl className="grid gap-3 text-sm">
      <DetailRow label="Concepto" value={transaction.description} strong />
      <DetailRow
        label="Monto"
        value={`${transaction.type === "income" ? "+" : "-"}${formatTransactionAmount(
          transaction.amount
        )}`}
        strong
      />
      <DetailRow label="Fecha" value={formatTransactionDate(transaction.date)} />
      <DetailRow label="Categoría" value={getCategoryLabel(transaction.category)} />
      <DetailRow
        label="Medio de pago"
        value={getPaymentMethodLabel(transaction.paymentMethod)}
      />
      <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
        <dt className="font-medium text-muted-foreground">Tipo</dt>
        <dd>
          <TransactionTypeBadge type={transaction.type} />
        </dd>
      </div>
      <div className="rounded-md border border-border bg-muted/40 p-3">
        <dt className="font-medium text-muted-foreground">Notas</dt>
        <dd className="mt-2 text-foreground">
          {transaction.notes?.trim() || "Sin notas adicionales."}
        </dd>
      </div>
    </dl>
  );
}

function DetailRow({
  label,
  value,
  strong = false
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
      <dt className="font-medium text-muted-foreground">{label}</dt>
      <dd className={strong ? "text-right font-semibold" : "text-right"}>
        {value}
      </dd>
    </div>
  );
}

function groupTransactionsByYear(
  transactions: readonly FinancialTransaction[]
): YearSummary[] {
  const groups = new Map<string, FinancialTransaction[]>();

  for (const transaction of transactions) {
    const year = transaction.date.slice(0, 4);
    groups.set(year, [...(groups.get(year) ?? []), transaction]);
  }

  return Array.from(groups.entries())
    .sort(([leftYear], [rightYear]) => rightYear.localeCompare(leftYear))
    .map(([year, yearTransactions]) => ({
      year,
      transactions: [...yearTransactions].sort(sortTransactionsByDateDesc),
      summary: calculateFinancialSummary(yearTransactions)
    }));
}

function createMonthSummaries(
  transactions: readonly FinancialTransaction[]
): MonthSummary[] {
  return monthNames.map((label, monthIndex) => {
    const month = String(monthIndex + 1).padStart(2, "0");
    const monthTransactions = transactions
      .filter((transaction) => transaction.date.slice(5, 7) === month)
      .sort(sortTransactionsByDateDesc);

    return {
      monthIndex,
      label,
      transactions: monthTransactions,
      summary: calculateFinancialSummary(monthTransactions)
    };
  });
}

function sortTransactionsByDateDesc(
  left: FinancialTransaction,
  right: FinancialTransaction
) {
  return (
    right.date.localeCompare(left.date) ||
    right.createdAt.localeCompare(left.createdAt)
  );
}

function SummaryCard({
  label,
  value,
  detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-2 text-2xl font-semibold tracking-normal text-foreground">
        {value}
      </dd>
      <dd className="mt-1 text-xs text-muted-foreground">{detail}</dd>
    </div>
  );
}
