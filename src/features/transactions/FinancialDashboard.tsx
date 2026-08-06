import {
  Cell,
  Pie,
  PieChart,
  Tooltip
} from "recharts";
import type { ExpenseCategoryGroup, FinancialSummary } from "@domain/transactions";
import { formatTransactionAmount } from "./formatters";

export interface FinancialDashboardProps {
  summary: FinancialSummary;
  expenseDistribution: ExpenseCategoryGroup[];
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
  expenseDistribution
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
          detail="Ingresos totales"
        />
        <SummaryCard
          label="Total egresos"
          value={formatTransactionAmount(summary.expenses)}
          detail="Egresos totales"
        />
        <SummaryCard
          label="Balance"
          value={formatTransactionAmount(summary.balance)}
          detail={balanceState}
        />
        <SummaryCard
          label="Movimientos"
          value={String(summary.transactionCount)}
          detail="Cantidad total"
        />
      </dl>

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
              No hay egresos para graficar.
            </div>
          )}
        </div>

        <div>
          <p className="text-sm text-muted-foreground">
            Distribucion calculada sobre egresos totales.
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
              El total de egresos es {formatTransactionAmount(0)}.
            </p>
          )}
        </div>
      </section>
    </section>
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
