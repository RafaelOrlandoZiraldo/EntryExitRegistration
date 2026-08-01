import { describe, expect, it } from "vitest";
import {
  CreateTransaction,
  DeleteTransaction,
  UpdateTransaction
} from "@application/use-cases";
import type { Clock, IdGenerator } from "@application/ports";
import type { FinancialTransaction } from "@domain/transactions";
import {
  CorruptedDataFileError,
  DataValidationError,
  UnsupportedSchemaVersionError
} from "./errors";
import { InMemoryTextFileAdapter } from "./InMemoryTextFileAdapter";
import {
  domesticFinanceFileName,
  OpfsTransactionRepository
} from "./OpfsTransactionRepository";

const fixedClock: Clock = {
  now: () => "2026-08-01T15:30:00.000Z"
};

const transaction: FinancialTransaction = {
  id: "transaction-1",
  type: "expense",
  date: "2026-08-01",
  amount: 300,
  category: "groceries",
  description: "Supermercado",
  paymentMethod: "debit_card",
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-01T10:00:00.000Z"
};

describe("OpfsTransactionRepository", () => {
  it("getAll_WhenFileDoesNotExist_ShouldInitializeEmptyVersionOneDocument", async () => {
    const adapter = new InMemoryTextFileAdapter();
    const repository = new OpfsTransactionRepository(adapter, fixedClock);

    await expect(repository.getAll()).resolves.toEqual([]);

    expect(readStoredDocument(adapter)).toEqual({
      schemaVersion: 1,
      lastUpdatedAt: "2026-08-01T15:30:00.000Z",
      transactions: []
    });
  });

  it("getAll_WhenFileExists_ShouldReloadStoredTransactions", async () => {
    const adapter = createAdapterWithDocument([transaction]);
    const repository = new OpfsTransactionRepository(adapter, fixedClock);

    await expect(repository.getAll()).resolves.toEqual([transaction]);
  });

  it("getDocument_WhenFileExists_ShouldReturnCompleteVersionedDocument", async () => {
    const adapter = createAdapterWithDocument([transaction]);
    const repository = new OpfsTransactionRepository(adapter, fixedClock);

    await expect(repository.getDocument()).resolves.toEqual({
      schemaVersion: 1,
      lastUpdatedAt: "2026-08-01T15:30:00.000Z",
      transactions: [transaction]
    });
  });

  it("replaceDocument_WhenDocumentIsValid_ShouldReplaceStoredDocumentWithoutMerging", async () => {
    const adapter = createAdapterWithDocument([transaction]);
    const repository = new OpfsTransactionRepository(adapter, fixedClock);
    const importedTransaction = {
      ...transaction,
      id: "imported-transaction",
      description: "Importado"
    };

    await repository.replaceDocument({
      schemaVersion: 1,
      lastUpdatedAt: "2026-08-10T12:00:00.000Z",
      transactions: [importedTransaction]
    });

    expect(readStoredDocument(adapter)).toEqual({
      schemaVersion: 1,
      lastUpdatedAt: "2026-08-10T12:00:00.000Z",
      transactions: [importedTransaction]
    });
  });

  it("useCases_WhenMutatingTransactions_ShouldPersistCrudChanges", async () => {
    const adapter = new InMemoryTextFileAdapter();
    const repository = new OpfsTransactionRepository(adapter, fixedClock);
    const idGenerator: IdGenerator = { generate: () => "created-id" };
    const createTransaction = new CreateTransaction({
      repository,
      clock: fixedClock,
      idGenerator
    });
    const updateTransaction = new UpdateTransaction({
      repository,
      clock: fixedClock
    });
    const deleteTransaction = new DeleteTransaction({ repository });

    await createTransaction.execute({
      type: "income",
      date: "2026-08-02",
      amount: 1200,
      category: "sale",
      description: "Venta",
      paymentMethod: "cash"
    });
    await updateTransaction.execute({
      id: "created-id",
      type: "income",
      date: "2026-08-03",
      amount: 1500,
      category: "sale",
      description: "Venta actualizada",
      paymentMethod: "cash"
    });
    await deleteTransaction.execute("created-id");

    const reloadedRepository = new OpfsTransactionRepository(adapter, fixedClock);

    await expect(reloadedRepository.getAll()).resolves.toEqual([]);
  });

  it("getAll_WhenJsonIsInvalid_ShouldRejectWithoutOverwritingFile", async () => {
    const adapter = new InMemoryTextFileAdapter(
      new Map([[domesticFinanceFileName, "{not-json"]])
    );
    const repository = new OpfsTransactionRepository(adapter, fixedClock);

    await expect(repository.getAll()).rejects.toThrow(CorruptedDataFileError);
    expect(adapter.peek(domesticFinanceFileName)).toBe("{not-json");
  });

  it("getAll_WhenSchemaIsInvalid_ShouldRejectWithoutOverwritingFile", async () => {
    const storedContents = JSON.stringify({
      schemaVersion: 1,
      lastUpdatedAt: "2026-08-01T15:30:00.000Z",
      transactions: [{ ...transaction, amount: -1 }]
    });
    const adapter = new InMemoryTextFileAdapter(
      new Map([[domesticFinanceFileName, storedContents]])
    );
    const repository = new OpfsTransactionRepository(adapter, fixedClock);

    await expect(repository.getAll()).rejects.toThrow(DataValidationError);
    expect(adapter.peek(domesticFinanceFileName)).toBe(storedContents);
  });

  it("getAll_WhenSchemaVersionIsUnsupported_ShouldRejectWithoutOverwritingFile", async () => {
    const storedContents = JSON.stringify({
      schemaVersion: 99,
      lastUpdatedAt: "2026-08-01T15:30:00.000Z",
      transactions: []
    });
    const adapter = new InMemoryTextFileAdapter(
      new Map([[domesticFinanceFileName, storedContents]])
    );
    const repository = new OpfsTransactionRepository(adapter, fixedClock);

    await expect(repository.getAll()).rejects.toThrow(
      UnsupportedSchemaVersionError
    );
    expect(adapter.peek(domesticFinanceFileName)).toBe(storedContents);
  });

  it("updateAll_WhenWritesAreRapid_ShouldSerializeAndAvoidLostUpdates", async () => {
    const adapter = new InMemoryTextFileAdapter();
    const repository = new OpfsTransactionRepository(adapter, fixedClock);
    let nextId = 0;
    const idGenerator: IdGenerator = {
      generate: () => {
        nextId += 1;
        return `created-id-${nextId}`;
      }
    };
    const createTransaction = new CreateTransaction({
      repository,
      clock: fixedClock,
      idGenerator
    });

    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        createTransaction.execute({
          type: "expense",
          date: "2026-08-01",
          amount: index + 1,
          category: "groceries",
          description: `Compra ${index + 1}`,
          paymentMethod: "debit_card"
        })
      )
    );

    const reloadedRepository = new OpfsTransactionRepository(adapter, fixedClock);
    const reloadedTransactions = await reloadedRepository.getAll();

    expect(reloadedTransactions).toHaveLength(10);
    expect(reloadedTransactions.map((item) => item.id).sort()).toEqual([
      "created-id-1",
      "created-id-10",
      "created-id-2",
      "created-id-3",
      "created-id-4",
      "created-id-5",
      "created-id-6",
      "created-id-7",
      "created-id-8",
      "created-id-9"
    ]);
  });
});

function createAdapterWithDocument(transactions: FinancialTransaction[]) {
  return new InMemoryTextFileAdapter(
    new Map([
      [
        domesticFinanceFileName,
        JSON.stringify({
          schemaVersion: 1,
          lastUpdatedAt: "2026-08-01T15:30:00.000Z",
          transactions
        })
      ]
    ])
  );
}

function readStoredDocument(adapter: InMemoryTextFileAdapter) {
  const contents = adapter.peek(domesticFinanceFileName);

  if (contents === null) {
    throw new Error("Expected stored document to exist.");
  }

  return JSON.parse(contents) as unknown;
}
