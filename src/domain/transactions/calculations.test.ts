import { describe, expect, it } from "vitest";
import {
  calculateBalance,
  calculateExpenses,
  calculateFinancialSummary,
  calculateIncome,
  groupExpensesByCategory
} from "./calculations";
import type { FinancialTransaction } from "./types";

const transactions: FinancialTransaction[] = [
  {
    id: "income-1",
    type: "income",
    date: "2026-08-01",
    amount: 2000,
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
    amount: 500,
    category: "rent",
    description: "Alquiler",
    paymentMethod: "bank_transfer",
    createdAt: "2026-08-02T10:00:00.000Z",
    updatedAt: "2026-08-02T10:00:00.000Z"
  },
  {
    id: "expense-2",
    type: "expense",
    date: "2026-08-03",
    amount: 250,
    category: "groceries",
    description: "Supermercado",
    paymentMethod: "debit_card",
    createdAt: "2026-08-03T10:00:00.000Z",
    updatedAt: "2026-08-03T10:00:00.000Z"
  }
];

describe("financial calculations", () => {
  it("calculateFinancialSummary_WhenTransactionsExist_ShouldReturnDerivedTotals", () => {
    expect(calculateIncome(transactions)).toBe(2000);
    expect(calculateExpenses(transactions)).toBe(750);
    expect(calculateBalance(transactions)).toBe(1250);
    expect(calculateFinancialSummary(transactions)).toEqual({
      income: 2000,
      expenses: 750,
      balance: 1250,
      transactionCount: 3
    });
  });

  it("groupExpensesByCategory_WhenExpensesExist_ShouldReturnAmountsAndProportions", () => {
    expect(groupExpensesByCategory(transactions)).toEqual([
      {
        category: "rent",
        label: "Alquiler",
        amount: 500,
        proportion: 500 / 750
      },
      {
        category: "groceries",
        label: "Supermercado",
        amount: 250,
        proportion: 250 / 750
      }
    ]);
  });

  it("groupExpensesByCategory_WhenThereAreNoExpenses_ShouldReturnEmptyDistribution", () => {
    expect(groupExpensesByCategory([transactions[0]])).toEqual([]);
  });
});
