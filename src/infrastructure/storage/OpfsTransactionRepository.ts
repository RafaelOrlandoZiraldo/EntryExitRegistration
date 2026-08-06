import type { TransactionRepository } from "@application/ports";
import type { Clock } from "@application/ports";
import {
  currentStorageSchemaVersion,
  storageDocumentSchema,
  type StorageDocument
} from "@domain/storage";
import {
  calculateFinancialSummary,
  groupExpensesByCategory,
  searchTransactions,
  type FinancialTransaction
} from "@domain/transactions";
import { CorruptedDataFileError, DataValidationError } from "./errors";
import { migrateStorageDocument } from "./migrations";
import type { TextFileAdapter } from "./TextFileAdapter";

export const domesticFinanceFileName = "domestic-finance.json";

export class OpfsTransactionRepository implements TransactionRepository {
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly fileAdapter: TextFileAdapter,
    private readonly clock: Clock,
    private readonly fileName = domesticFinanceFileName
  ) {}

  async getAll() {
    const document = await this.loadOrCreateDocument();

    return [...document.transactions];
  }

  async getPage({
    pageIndex,
    pageSize,
    filters,
    sort
  }: Parameters<TransactionRepository["getPage"]>[0]) {
    const transactions = searchTransactions(await this.getAll(), {
      filters,
      sort
    });
    const start = pageIndex * pageSize;

    return {
      transactions: transactions.slice(start, start + pageSize),
      total: transactions.length,
      dashboard: {
        summary: calculateFinancialSummary(transactions),
        expenseDistribution: groupExpensesByCategory(transactions)
      }
    };
  }

  async getDocument() {
    return this.loadOrCreateDocument();
  }

  async replaceDocument(document: StorageDocument) {
    const result = storageDocumentSchema.safeParse(document);

    if (!result.success) {
      throw new DataValidationError({ cause: result.error });
    }

    await this.enqueueWrite(async () => {
      await this.writeDocument(result.data);
    });
  }

  async replaceAll(transactions: readonly FinancialTransaction[]) {
    await this.updateAll(() => transactions);
  }

  updateAll(
    updater: (
      transactions: readonly FinancialTransaction[]
    ) => readonly FinancialTransaction[]
  ) {
    return this.enqueueWrite(async () => {
      const currentDocument = await this.loadOrCreateDocument();
      const nextTransactions = [...updater(currentDocument.transactions)];
      const nextDocument = this.createDocument(nextTransactions);

      await this.writeDocument(nextDocument);

      return [...nextDocument.transactions];
    });
  }

  private enqueueWrite<T>(operation: () => Promise<T>) {
    const nextOperation = this.writeQueue.then(operation, operation);
    this.writeQueue = nextOperation.catch(() => undefined);

    return nextOperation;
  }

  private async loadOrCreateDocument() {
    const contents = await this.fileAdapter.readText(this.fileName);

    if (contents === null) {
      const initialDocument = this.createDocument([]);
      await this.writeDocument(initialDocument);

      return initialDocument;
    }

    if (contents.trim() === "") {
      throw new CorruptedDataFileError();
    }

    return parseStorageDocument(contents);
  }

  private createDocument(
    transactions: readonly FinancialTransaction[]
  ): StorageDocument {
    const result = storageDocumentSchema.safeParse({
      schemaVersion: currentStorageSchemaVersion,
      lastUpdatedAt: this.clock.now(),
      transactions
    });

    if (!result.success) {
      throw new DataValidationError({ cause: result.error });
    }

    return result.data;
  }

  private async writeDocument(document: StorageDocument) {
    await this.fileAdapter.writeText(
      this.fileName,
      `${JSON.stringify(document, null, 2)}\n`
    );
  }
}

function parseStorageDocument(contents: string) {
  try {
    return migrateStorageDocument(JSON.parse(contents) as unknown);
  } catch (error) {
    if (error instanceof DataValidationError) {
      throw error;
    }

    if (error instanceof SyntaxError) {
      throw new CorruptedDataFileError({ cause: error });
    }

    throw error;
  }
}
