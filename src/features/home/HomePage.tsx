import { Link } from "react-router-dom";
import { EmptyState, PageTitle, TransactionTypeBadge } from "@shared/ui";
import { Button } from "@shared/ui/button";

export function HomePage() {
  return (
    <section className="grid gap-6">
      <PageTitle
        eyebrow="Panel principal"
        title="Registro domestico de ingresos y egresos"
        description="Vista inicial preparada para el dashboard financiero del MVP."
        actions={
          <Button asChild variant="outline">
            <Link to="/transactions">Ver movimientos</Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Ingresos" value="$0,00" tone="income" />
        <SummaryCard label="Egresos" value="$0,00" tone="expense" />
        <SummaryCard label="Balance" value="$0,00" tone="neutral" />
        <SummaryCard label="Movimientos" value="0" tone="neutral" />
      </div>

      <EmptyState
        title="Sin movimientos registrados"
        message="El listado aparecera cuando exista informacion guardada en el archivo local."
      />
    </section>
  );
}

function SummaryCard({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "income" | "expense" | "neutral";
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {tone === "income" ? <TransactionTypeBadge type="income" /> : null}
        {tone === "expense" ? <TransactionTypeBadge type="expense" /> : null}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-normal">{value}</p>
    </article>
  );
}
