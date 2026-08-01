import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FinancialDashboard } from "./FinancialDashboard";

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
      />
    );

    expect(screen.getByText("Total ingresos")).toBeInTheDocument();
    expect(screen.getByText(/\$\s1\.000,00/)).toBeInTheDocument();
    expect(screen.getByText("Total egresos")).toBeInTheDocument();
    expect(screen.getByText(/\$\s400,00/)).toBeInTheDocument();
    expect(screen.getByText("Balance")).toBeInTheDocument();
    expect(screen.getByText(/\$\s600,00/)).toBeInTheDocument();
    expect(screen.getByText("Movimientos")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
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
      />
    );

    expect(
      screen.getByText("No hay egresos visibles para graficar.")
    ).toBeInTheDocument();
    expect(screen.getAllByText(/\$\s0,00/)).not.toHaveLength(0);
  });
});
