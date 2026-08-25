import { Award, BadgePercent, ReceiptText, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { SalesDashboard } from "@app/services/sales";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageTitle
} from "@shared/ui";

interface SalesDashboardPageProps {
  salesService: {
    dashboard(this: void): Promise<SalesDashboard>;
  };
}

type LoadState =
  | { status: "loading" }
  | { status: "success"; dashboard: SalesDashboard }
  | { status: "error"; error: string };

export function SalesDashboardPage({ salesService }: SalesDashboardPageProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  const loadDashboard = useCallback(() => {
    setState({ status: "loading" });
    void salesService
      .dashboard()
      .then((dashboard) => {
        setState({ status: "success", dashboard });
      })
      .catch(() => {
        setState({
          status: "error",
          error: "No se pudo cargar el dashboard de ventas."
        });
      });
  }, [salesService]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  return (
    <section className="grid gap-6">
      <PageTitle
        eyebrow="Ventas"
        title="Mi dashboard"
        description="Seguimiento mensual de ventas, comisiones y premios."
      />

      {state.status === "loading" ? (
        <LoadingState title="Cargando ventas" />
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
        state.dashboard.profile.catalogUserId.length === 0 ? (
          <EmptyState
            title="Sin configuracion"
            message="Todavia no hay una configuracion comercial para este vendedor."
          />
        ) : (
          <DashboardContent dashboard={state.dashboard} />
        )
      ) : null}
    </section>
  );
}

function DashboardContent({ dashboard }: { dashboard: SalesDashboard }) {
  const remaining = Math.max(
    0,
    dashboard.profile.bonusGoalAmount - dashboard.month.totalAmount
  );

  return (
    <div className="grid gap-6">
      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard
          icon={TrendingUp}
          label="Ventas del mes"
          value={formatMoney(dashboard.month.totalAmount)}
        />
        <MetricCard
          icon={ReceiptText}
          label="Pedidos del mes"
          value={formatNumber(dashboard.month.orderCount)}
        />
        <MetricCard
          icon={BadgePercent}
          label="Comision estimada"
          value={formatMoney(dashboard.month.commissionAmount)}
        />
        <MetricCard
          icon={Award}
          label="A cobrar"
          value={formatMoney(dashboard.month.estimatedPayout)}
        />
      </section>

      <section className="grid gap-4 rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Premio mensual</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Objetivo {formatMoney(dashboard.profile.bonusGoalAmount)} - premio{" "}
              {formatMoney(dashboard.profile.bonusAmount)}
            </p>
          </div>
          <p className="text-sm font-medium">
            {formatPercent(dashboard.month.goalProgress)}
          </p>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${dashboard.month.goalProgress}%` }}
          />
        </div>
        <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
          <p>Faltante: {formatMoney(remaining)}</p>
          <p>Ticket promedio: {formatMoney(dashboard.month.averageOrderAmount)}</p>
          <p>Historico: {formatMoney(dashboard.allTime.totalAmount)}</p>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-secondary-foreground">
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 truncate text-xl font-semibold">{value}</p>
        </div>
      </div>
    </article>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS"
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR").format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 2
  }).format(value)}%`;
}
