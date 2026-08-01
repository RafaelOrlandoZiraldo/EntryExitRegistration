import { describe, expect, it } from "vitest";
import { DomainValidationError } from "@domain/errors";
import { searchTransactions } from "./search";
import type { FinancialTransaction } from "./types";

const transactions: FinancialTransaction[] = [
  {
    id: "1",
    type: "income",
    date: "2026-08-01",
    amount: 3000,
    category: "salary",
    description: "Sueldo mensual",
    paymentMethod: "bank_transfer",
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z"
  },
  {
    id: "2",
    type: "expense",
    date: "2026-08-05",
    amount: 200,
    category: "groceries",
    description: "Compra semanal",
    paymentMethod: "debit_card",
    notes: "Verduras y limpieza",
    createdAt: "2026-08-05T10:00:00.000Z",
    updatedAt: "2026-08-05T10:00:00.000Z"
  },
  {
    id: "3",
    type: "expense",
    date: "2026-08-10",
    amount: 100,
    category: "transport",
    description: "Sube",
    paymentMethod: "digital_wallet",
    createdAt: "2026-08-10T10:00:00.000Z",
    updatedAt: "2026-08-10T10:00:00.000Z"
  }
];

describe("searchTransactions", () => {
  it("searchTransactions_WhenFiltersAreCombined_ShouldApplyAndLogic", () => {
    const result = searchTransactions(transactions, {
      filters: {
        dateFrom: "2026-08-01",
        dateTo: "2026-08-06",
        type: "expense",
        paymentMethod: "debit_card",
        text: "limpieza",
        amountMin: 100,
        amountMax: 250
      }
    });

    expect(result.map((transaction) => transaction.id)).toEqual(["2"]);
  });

  it("searchTransactions_WhenSortByAmountAscending_ShouldReturnSortedCopy", () => {
    const result = searchTransactions(transactions, {
      sort: { field: "amount", direction: "asc" }
    });

    expect(result.map((transaction) => transaction.id)).toEqual([
      "3",
      "2",
      "1"
    ]);
    expect(transactions.map((transaction) => transaction.id)).toEqual([
      "1",
      "2",
      "3"
    ]);
  });

  it("searchTransactions_WhenDateRangeIsInvalid_ShouldReject", () => {
    expect(() =>
      searchTransactions(transactions, {
        filters: {
          dateFrom: "2026-08-10",
          dateTo: "2026-08-01"
        }
      })
    ).toThrow(DomainValidationError);
  });

  it("searchTransactions_WhenAmountRangeIsInvalid_ShouldReject", () => {
    expect(() =>
      searchTransactions(transactions, {
        filters: {
          amountMin: 300,
          amountMax: 100
        }
      })
    ).toThrow(DomainValidationError);
  });

  it("searchTransactions_WhenTextHasSpacesAndDifferentCase_ShouldTrimAndMatchDescriptionOrNotes", () => {
    const result = searchTransactions(transactions, {
      filters: {
        text: "  LIMPIEZA  "
      }
    });

    expect(result.map((transaction) => transaction.id)).toEqual(["2"]);
  });

  it("searchTransactions_WhenFilteringAndSorting_ShouldNotMutateInput", () => {
    const originalIds = transactions.map((transaction) => transaction.id);

    const result = searchTransactions(transactions, {
      filters: {
        amountMin: 100
      },
      sort: {
        field: "amount",
        direction: "asc"
      }
    });

    expect(result.map((transaction) => transaction.id)).toEqual(["3", "2", "1"]);
    expect(transactions.map((transaction) => transaction.id)).toEqual(
      originalIds
    );
  });
});
