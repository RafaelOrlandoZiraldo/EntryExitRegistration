import type {
  GetTransactionsPageInput,
  TransactionRepository
} from "@application/ports";
import {
  calculateFinancialSummary,
  groupExpensesByCategory,
  type FinancialTransaction,
  financialTransactionSchema
} from "@domain/transactions";
import {
  type StorageDocument,
  currentStorageSchemaVersion,
  storageDocumentSchema
} from "@domain/storage";
import { StorageWriteError } from "./errors";

export class HttpTransactionRepository implements TransactionRepository {
  async getAll(): Promise<FinancialTransaction[]> {
    const response = await fetch("/api/transactions", {
      credentials: "include"
    });
    const body = (await readSuccessfulJson(response)) as {
      transactions?: unknown;
    };

    return financialTransactionSchema.array().parse(body.transactions);
  }

  async getPage({
    pageIndex,
    pageSize,
    filters = {},
    sort = { field: "date", direction: "desc" }
  }: GetTransactionsPageInput) {
    const params = new URLSearchParams({
      pageIndex: String(pageIndex),
      pageSize: String(pageSize),
      sortField: sort.field,
      sortDirection: sort.direction
    });

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) {
        params.set(key, String(value));
      }
    });

    const response = await fetch(`/api/transactions?${params.toString()}`, {
      credentials: "include"
    });
    const body = (await readSuccessfulJson(response)) as {
      dashboard?: unknown;
      transactions?: unknown;
      total?: unknown;
    };
    const transactions = financialTransactionSchema
      .array()
      .parse(body.transactions);
    const total =
      typeof body.total === "number" ? body.total : transactions.length;
    const pageTransactions =
      typeof body.total === "number"
        ? transactions
        : transactions.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

    return {
      transactions: pageTransactions,
      total,
      dashboard: readDashboard(body.dashboard, transactions)
    };
  }

  async getDocument(): Promise<StorageDocument> {
    const response = await fetch("/api/export", {
      credentials: "include"
    });
    const body = (await readSuccessfulJson(response)) as {
      document?: unknown;
    };

    return storageDocumentSchema.parse(body.document);
  }

  async create(transaction: FinancialTransaction): Promise<void> {
    const response = await fetch("/api/transactions", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(transaction)
    });

    await readSuccessfulJson(response);
  }

  async getById(id: string): Promise<FinancialTransaction> {
    const response = await fetch(`/api/transactions/${encodeURIComponent(id)}`, {
      credentials: "include"
    });
    const body = (await readSuccessfulJson(response)) as {
      transaction?: unknown;
    };

    return financialTransactionSchema.parse(body.transaction);
  }

  async update(transaction: FinancialTransaction): Promise<void> {
    const response = await fetch(
      `/api/transactions/${encodeURIComponent(transaction.id)}`,
      {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(transaction)
      }
    );

    await readSuccessfulJson(response);
  }

  async delete(id: string): Promise<void> {
    const response = await fetch(`/api/transactions/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include"
    });

    await readSuccessfulJson(response);
  }

  async replaceDocument(document: StorageDocument): Promise<void> {
    const response = await fetch("/api/import", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ document })
    });

    await readSuccessfulJson(response);
  }

  async replaceAll(
    transactions: readonly FinancialTransaction[]
  ): Promise<void> {
    await this.replaceDocument({
      schemaVersion: currentStorageSchemaVersion,
      lastUpdatedAt: new Date().toISOString(),
      transactions: [...transactions]
    });
  }

  async updateAll(
    updater: (
      transactions: readonly FinancialTransaction[]
    ) => readonly FinancialTransaction[]
  ): Promise<FinancialTransaction[]> {
    const current = await this.getAll();
    const next = [...updater(current)];

    await this.replaceAll(next);

    return next;
  }
}

async function readSuccessfulJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new StorageWriteError();
  }

  return response.json();
}

function readDashboard(
  value: unknown,
  fallbackTransactions: readonly FinancialTransaction[]
) {
  if (
    typeof value === "object" &&
    value !== null &&
    "summary" in value &&
    "expenseDistribution" in value
  ) {
    return value as ReturnType<typeof createDashboard>;
  }

  return createDashboard(fallbackTransactions);
}

function createDashboard(transactions: readonly FinancialTransaction[]) {
  return {
    summary: calculateFinancialSummary(transactions),
    expenseDistribution: groupExpensesByCategory(transactions)
  };
}
