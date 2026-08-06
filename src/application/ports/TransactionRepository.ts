import type { StorageDocument } from "@domain/storage";
import type {
  ExpenseCategoryGroup,
  FinancialTransaction,
  FinancialSummary,
  TransactionFilters,
  TransactionSort
} from "@domain/transactions";

export interface GetTransactionsPageInput {
  pageIndex: number;
  pageSize: number;
  filters?: TransactionFilters;
  sort?: TransactionSort;
}

export interface GetTransactionsPageResult {
  transactions: FinancialTransaction[];
  total: number;
  dashboard: {
    summary: FinancialSummary;
    expenseDistribution: ExpenseCategoryGroup[];
  };
}

export interface TransactionRepository {
  getAll(): Promise<FinancialTransaction[]>;
  getPage(input: GetTransactionsPageInput): Promise<GetTransactionsPageResult>;
  getDocument(): Promise<StorageDocument>;
  replaceDocument(document: StorageDocument): Promise<void>;
  replaceAll(transactions: readonly FinancialTransaction[]): Promise<void>;
  updateAll(
    updater: (
      transactions: readonly FinancialTransaction[]
    ) => readonly FinancialTransaction[]
  ): Promise<FinancialTransaction[]>;
}
