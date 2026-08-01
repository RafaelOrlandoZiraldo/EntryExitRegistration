import { describe, expect, it } from "vitest";
import { storageDocumentSchema } from "@domain/storage";
import {
  expenseCategoryOptions,
  financialTransactionSchema,
  incomeCategoryOptions,
  paymentMethodOptions
} from "./index";

const validTransaction = {
  id: "transaction-1",
  type: "expense",
  date: "2026-08-01",
  amount: 120,
  category: "groceries",
  description: "Supermercado",
  paymentMethod: "debit_card",
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-01T10:00:00.000Z"
} as const;

describe("transaction schemas and catalogs", () => {
  it("financialTransactionSchema_WhenTransactionIsValid_ShouldParse", () => {
    expect(financialTransactionSchema.parse(validTransaction)).toEqual(
      validTransaction
    );
  });

  it("financialTransactionSchema_WhenAmountIsNegative_ShouldReject", () => {
    expect(() =>
      financialTransactionSchema.parse({
        ...validTransaction,
        amount: -1
      })
    ).toThrow();
  });

  it("financialTransactionSchema_WhenCategoryDoesNotMatchType_ShouldReject", () => {
    expect(() =>
      financialTransactionSchema.parse({
        ...validTransaction,
        type: "income",
        category: "groceries"
      })
    ).toThrow();
  });

  it("storageDocumentSchema_WhenSchemaVersionIsCurrent_ShouldParse", () => {
    expect(
      storageDocumentSchema.parse({
        schemaVersion: 1,
        lastUpdatedAt: "2026-08-01T10:00:00.000Z",
        transactions: [validTransaction]
      })
    ).toEqual({
      schemaVersion: 1,
      lastUpdatedAt: "2026-08-01T10:00:00.000Z",
      transactions: [validTransaction]
    });
  });

  it("catalogs_WhenRead_ShouldExposeStableKeysWithSpanishLabels", () => {
    expect(incomeCategoryOptions[0]).toEqual({
      key: "salary",
      label: "Sueldo"
    });
    expect(expenseCategoryOptions[0]).toEqual({
      key: "rent",
      label: "Alquiler"
    });
    expect(paymentMethodOptions).toContainEqual({
      key: "digital_wallet",
      label: "Billetera virtual"
    });
  });
});
