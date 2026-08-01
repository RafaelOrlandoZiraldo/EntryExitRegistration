import { describe, expect, it } from "vitest";
import {
  createEmptyTransactionFilterDraft,
  parseTransactionFilterDraft
} from "./transactionFilterForm";

describe("parseTransactionFilterDraft", () => {
  it("parseTransactionFilterDraft_WhenDraftIsValid_ShouldTrimAndParseValues", () => {
    expect(
      parseTransactionFilterDraft({
        ...createEmptyTransactionFilterDraft(),
        dateFrom: "2026-08-01",
        dateTo: "2026-08-31",
        type: "expense",
        category: "groceries",
        paymentMethod: "debit_card",
        text: "  limpieza  ",
        amountMin: "100",
        amountMax: "500.5",
        sortField: "amount",
        sortDirection: "asc"
      })
    ).toEqual({
      success: true,
      filters: {
        dateFrom: "2026-08-01",
        dateTo: "2026-08-31",
        type: "expense",
        category: "groceries",
        paymentMethod: "debit_card",
        text: "limpieza",
        amountMin: 100,
        amountMax: 500.5
      },
      sort: {
        field: "amount",
        direction: "asc"
      }
    });
  });

  it("parseTransactionFilterDraft_WhenDateRangeIsInvalid_ShouldReturnErrors", () => {
    expect(
      parseTransactionFilterDraft({
        ...createEmptyTransactionFilterDraft(),
        dateFrom: "2026-08-31",
        dateTo: "2026-08-01"
      })
    ).toEqual({
      success: false,
      errors: {
        dateFrom: "Revisar el rango de fechas."
      }
    });
  });

  it("parseTransactionFilterDraft_WhenAmountRangeIsInvalid_ShouldReturnErrors", () => {
    expect(
      parseTransactionFilterDraft({
        ...createEmptyTransactionFilterDraft(),
        amountMin: "1000",
        amountMax: "10"
      })
    ).toEqual({
      success: false,
      errors: {
        amountMin: "Revisar el rango de importes."
      }
    });
  });
});
