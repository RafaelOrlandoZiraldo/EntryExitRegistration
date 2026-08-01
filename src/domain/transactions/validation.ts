import { DomainValidationError } from "@domain/errors";
import { financialTransactionSchema } from "./schemas";
import type { FinancialTransaction } from "./types";

export function validateFinancialTransaction(
  transaction: FinancialTransaction
) {
  const result = financialTransactionSchema.safeParse(transaction);

  if (!result.success) {
    throw new DomainValidationError("Invalid financial transaction.");
  }

  return result.data;
}
