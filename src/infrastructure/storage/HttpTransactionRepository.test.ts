import { afterEach, describe, expect, it, vi } from "vitest";
import {
  calculateFinancialSummary,
  groupExpensesByCategory,
  type FinancialTransaction
} from "@domain/transactions";
import { HttpTransactionRepository } from "./HttpTransactionRepository";

const transaction: FinancialTransaction = {
  id: "transaction-1",
  type: "income",
  date: "2026-08-01",
  amount: 1500,
  category: "salary",
  description: "Sueldo",
  paymentMethod: "bank_transfer",
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-01T10:00:00.000Z"
};

describe("HttpTransactionRepository", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getPage_WhenApiReturnsPagedShape_ShouldUseServerTotal", async () => {
    const fetch = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            dashboard: createDashboard([transaction]),
            transactions: [transaction],
            total: 42
          }),
          { status: 200 }
        )
      )
    );
    vi.stubGlobal("fetch", fetch);
    const repository = new HttpTransactionRepository();

    await expect(
      repository.getPage({ pageIndex: 1, pageSize: 10 })
    ).resolves.toEqual({
      transactions: [transaction],
      total: 42,
      dashboard: createDashboard([transaction])
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/transactions?pageIndex=1&pageSize=10&sortField=date&sortDirection=desc",
      { credentials: "include" }
    );
  });

  it("getPage_WhenApiReturnsLegacyShape_ShouldNotExposeAllRowsOrZeroTotal", async () => {
    const transactions = Array.from({ length: 12 }, (_, index) => ({
      ...transaction,
      id: `transaction-${index + 1}`,
      description: `Movimiento ${index + 1}`
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ transactions }), { status: 200 })
        )
      )
    );
    const repository = new HttpTransactionRepository();

    await expect(
      repository.getPage({ pageIndex: 0, pageSize: 10 })
    ).resolves.toEqual({
      transactions: transactions.slice(0, 10),
      total: 12,
      dashboard: createDashboard(transactions)
    });
  });
});

function createDashboard(transactions: readonly FinancialTransaction[]) {
  return {
    summary: calculateFinancialSummary(transactions),
    expenseDistribution: groupExpensesByCategory(transactions)
  };
}
