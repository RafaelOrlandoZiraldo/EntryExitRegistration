import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { FinancialTransaction } from "@domain/transactions";
import { FinancialDashboard } from "./FinancialDashboard";

const dashboardTransactions: FinancialTransaction[] = [
  {
    id: "transaction-1",
    type: "income",
    date: "2026-08-01",
    amount: 1000,
    category: "salary",
    description: "Sueldo",
    paymentMethod: "bank_transfer",
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z"
  },
  {
    id: "transaction-2",
    type: "expense",
    date: "2026-08-05",
    amount: 300,
    category: "groceries",
    description: "Compra mensual",
    paymentMethod: "debit_card",
    notes: "Compra grande del mes.",
    createdAt: "2026-08-05T10:00:00.000Z",
    updatedAt: "2026-08-05T10:00:00.000Z"
  },
  {
    id: "transaction-3",
    type: "expense",
    date: "2025-01-05",
    amount: 100,
    category: "transport",
    description: "Sube",
    paymentMethod: "cash",
    createdAt: "2025-01-05T10:00:00.000Z",
    updatedAt: "2025-01-05T10:00:00.000Z"
  }
];

describe("FinancialDashboard", () => {
  it("FinancialDashboard_WhenDataExists_ShouldRenderSummaryAndExpenseDistribution", () => {
    render(
      <FinancialDashboard
        expenseDistribution={[
          {
            category: "groceries",
            label: "Supermercado",
            amount: 300,
            proportion: 0.75
          },
          {
            category: "transport",
            label: "Transporte",
            amount: 100,
            proportion: 0.25
          }
        ]}
        summary={{
          income: 1000,
          expenses: 400,
          balance: 600,
          transactionCount: 3
        }}
        transactions={dashboardTransactions}
      />
    );

    const dashboard = within(
      screen.getByRole("region", { name: "Indicadores financieros" })
    );

    expect(dashboard.getAllByText("Total ingresos")).not.toHaveLength(0);
    expect(dashboard.getAllByText(/\$\s1\.000,00/)).not.toHaveLength(0);
    expect(dashboard.getAllByText("Total egresos")).not.toHaveLength(0);
    expect(dashboard.getByText(/\$\s400,00/)).toBeInTheDocument();
    expect(dashboard.getAllByText("Balance")).not.toHaveLength(0);
    expect(dashboard.getByText(/\$\s600,00/)).toBeInTheDocument();
    expect(dashboard.getAllByText("Movimientos")).not.toHaveLength(0);
    expect(dashboard.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Supermercado")).toBeInTheDocument();
    expect(screen.getByText(/\$\s300,00 -\s75%/)).toBeInTheDocument();
    expect(screen.getByText("Transporte")).toBeInTheDocument();
    expect(screen.getByTestId("expense-distribution-chart")).toBeInTheDocument();
  });

  it("FinancialDashboard_WhenThereAreZeroExpenses_ShouldRenderGracefulEmptyChartContext", () => {
    render(
      <FinancialDashboard
        expenseDistribution={[]}
        summary={{
          income: 1000,
          expenses: 0,
          balance: 1000,
          transactionCount: 1
        }}
        transactions={[]}
      />
    );

    expect(
      screen.getByText("No hay egresos visibles para graficar.")
    ).toBeInTheDocument();
    expect(screen.getAllByText(/\$\s0,00/)).not.toHaveLength(0);
  });

  it("FinancialDashboard_WhenHistoryYearMonthAndTransactionAreSelected_ShouldShowRealCurrentData", async () => {
    const user = userEvent.setup();
    render(
      <FinancialDashboard
        expenseDistribution={[]}
        summary={{
          income: 1000,
          expenses: 400,
          balance: 600,
          transactionCount: 3
        }}
        transactions={dashboardTransactions}
      />
    );

    await user.click(screen.getByRole("button", { name: /Historial 2026/i }));

    expect(
      screen.getByRole("dialog", { name: /2026: resumen mensual/i })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Agosto/i }));

    expect(
      screen.getByRole("dialog", { name: /Movimientos de Agosto 2026/i })
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Compra mensual/i }));

    expect(
      screen.getByRole("dialog", { name: /Detalle de la transacción/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Compra grande del mes.")).toBeInTheDocument();
    expect(screen.getByText("Debito")).toBeInTheDocument();
  });
});
