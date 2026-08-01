import { describe, expect, it } from "vitest";
import type { FinancialTransaction } from "@domain/transactions";
import {
  createTransactionDashboardSelector,
  selectTransactionDashboard
} from "./transactionDashboardSelectors";

const transactions: FinancialTransaction[] = [
  {
    id: "income-1",
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
    id: "expense-1",
    type: "expense",
    date: "2026-08-02",
    amount: 250,
    category: "groceries",
    description: "Supermercado",
    paymentMethod: "debit_card",
    createdAt: "2026-08-02T10:00:00.000Z",
    updatedAt: "2026-08-02T10:00:00.000Z"
  }
];

describe("transaction dashboard selectors", () => {
  it("selectTransactionDashboard_WhenTransactionsAreVisible_ShouldReturnDerivedData", () => {
    expect(selectTransactionDashboard(transactions)).toEqual({
      summary: {
        income: 1000,
        expenses: 250,
        balance: 750,
        transactionCount: 2
      },
      expenseDistribution: [
        {
          category: "groceries",
          label: "Supermercado",
          amount: 250,
          proportion: 1
        }
      ]
    });
  });

  it("createTransactionDashboardSelector_WhenInputReferenceIsStable_ShouldReuseResult", () => {
    const selector = createTransactionDashboardSelector();
    const firstResult = selector(transactions);
    const secondResult = selector(transactions);

    expect(secondResult).toBe(firstResult);
    expect(selector([...transactions])).not.toBe(firstResult);
  });
});
