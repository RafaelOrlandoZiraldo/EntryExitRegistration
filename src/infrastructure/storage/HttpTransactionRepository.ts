import type { TransactionRepository } from "@application/ports";
import {
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

  async getDocument(): Promise<StorageDocument> {
    const response = await fetch("/api/export", {
      credentials: "include"
    });
    const body = (await readSuccessfulJson(response)) as {
      document?: unknown;
    };

    return storageDocumentSchema.parse(body.document);
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

  async deleteAll(): Promise<void> {
    const response = await fetch("/api/transactions", {
      method: "DELETE",
      credentials: "include"
    });

    await readSuccessfulJson(response);
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
