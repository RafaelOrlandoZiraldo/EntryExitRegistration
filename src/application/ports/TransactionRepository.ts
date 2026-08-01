import type { StorageDocument } from "@domain/storage";
import type { FinancialTransaction } from "@domain/transactions";

export interface TransactionRepository {
  getAll(): Promise<FinancialTransaction[]>;
  getDocument(): Promise<StorageDocument>;
  replaceDocument(document: StorageDocument): Promise<void>;
  replaceAll(transactions: readonly FinancialTransaction[]): Promise<void>;
  updateAll(
    updater: (
      transactions: readonly FinancialTransaction[]
    ) => readonly FinancialTransaction[]
  ): Promise<FinancialTransaction[]>;
}
