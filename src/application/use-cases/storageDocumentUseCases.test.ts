import { describe, expect, it, vi } from "vitest";
import type { TransactionRepository } from "@application/ports";
import type { StorageDocument } from "@domain/storage";
import type { FinancialTransaction } from "@domain/transactions";
import {
  ExportStorageDocument,
  ImportStorageDocument,
  ImportValidationError,
  PreviewImportStorageDocument,
  UnsupportedImportVersionError
} from "./storageDocumentUseCases";

const document: StorageDocument = {
  schemaVersion: 1,
  lastUpdatedAt: "2026-08-01T15:30:00.000Z",
  transactions: [
    {
      id: "transaction-1",
      type: "income",
      date: "2026-08-01",
      amount: 1000,
      category: "salary",
      description: "Sueldo",
      paymentMethod: "bank_transfer",
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-01T10:00:00.000Z"
    }
  ]
};

describe("storage document use cases", () => {
  it("ExportStorageDocument_WhenExecuted_ShouldReturnCompleteVersionedDocumentAndDatedName", async () => {
    const repository = createRepository(document);
    const useCase = new ExportStorageDocument({
      repository,
      clock: { now: () => "2026-08-20T12:00:00.000Z" }
    });

    await expect(useCase.execute()).resolves.toMatchObject({
      fileName: "domestic-finance-2026-08-20.csv",
      contents: expect.stringContaining("schemaVersion,1"),
      document
    });
  });

  it("PreviewImportStorageDocument_WhenFileIsValid_ShouldReturnVersionAndCount", () => {
    const useCase = new PreviewImportStorageDocument();

    expect(useCase.execute(createExcelBackup(document))).toMatchObject({
      schemaVersion: 1,
      transactionCount: 1,
      document
    });
  });

  it("PreviewImportStorageDocument_WhenCsvUsesRegionalSeparator_ShouldImportSemicolonAndDecimalComma", () => {
    const useCase = new PreviewImportStorageDocument();
    const contents = createRegionalExcelBackup({
      ...document,
      transactions: [
        {
          ...document.transactions[0],
          amount: 1500.5
        }
      ]
    });

    expect(useCase.execute(contents)).toMatchObject({
      transactionCount: 1,
      document: {
        transactions: [
          expect.objectContaining({
            date: "2026-08-01",
            amount: 1500.5
          })
        ]
      }
    });
  });

  it("PreviewImportStorageDocument_WhenJsonIsInvalid_ShouldRejectBeforeWrite", () => {
    const useCase = new PreviewImportStorageDocument();

    expect(() => useCase.execute("bad-excel")).toThrow(ImportValidationError);
  });

  it("PreviewImportStorageDocument_WhenVersionIsUnsupported_ShouldRejectBeforeWrite", () => {
    const useCase = new PreviewImportStorageDocument();

    expect(() =>
      useCase.execute(
        createExcelBackup({
          ...document,
          schemaVersion: 99
        })
      )
    ).toThrow(UnsupportedImportVersionError);
  });

  it("ImportStorageDocument_WhenExecuted_ShouldAppendNewTransactionsWithoutDuplicatingIds", async () => {
    const existingTransaction: FinancialTransaction = {
      ...document.transactions[0],
      id: "existing-transaction",
      description: "Existente"
    };
    const duplicateTransaction: FinancialTransaction = {
      ...document.transactions[0],
      id: "existing-transaction",
      description: "Duplicado"
    };
    const newTransaction: FinancialTransaction = {
      ...document.transactions[0],
      id: "new-transaction",
      description: "Nuevo"
    };
    const repository = createRepository({
      ...document,
      transactions: [existingTransaction]
    });
    const useCase = new ImportStorageDocument({ repository });

    await expect(
      useCase.execute(
        createExcelBackup({
          ...document,
          transactions: [duplicateTransaction, newTransaction]
        })
      )
    ).resolves.toMatchObject({
      transactions: [
        expect.objectContaining({ id: "existing-transaction" }),
        expect.objectContaining({ id: "new-transaction" })
      ]
    });
    await expect(repository.getAll()).resolves.toEqual([
      existingTransaction,
      newTransaction
    ]);
  });

  it("ImportStorageDocument_WhenWriteFails_ShouldPreserveCurrentData", async () => {
    const repository = createRepository(document, true);
    const useCase = new ImportStorageDocument({ repository });

    await expect(useCase.execute(createExcelBackup(document))).rejects.toThrow(
      "write failed"
    );
    expect(await repository.getDocument()).toEqual(document);
  });
});

function createRepository(
  initialDocument: StorageDocument,
  failWrite = false
): TransactionRepository {
  let storedDocument = initialDocument;

  return {
    getAll: vi.fn(() => Promise.resolve([...storedDocument.transactions])),
    getDocument: vi.fn(() => Promise.resolve(storedDocument)),
    replaceDocument: vi.fn((nextDocument: StorageDocument) => {
      if (failWrite) {
        return Promise.reject(new Error("write failed"));
      }

      storedDocument = nextDocument;
      return Promise.resolve();
    }),
    replaceAll: vi.fn((transactions: readonly FinancialTransaction[]) => {
      storedDocument = {
        ...storedDocument,
        transactions: [...transactions]
      };
      return Promise.resolve();
    }),
    updateAll: vi.fn(
      (
        updater: (
          transactions: readonly FinancialTransaction[]
        ) => readonly FinancialTransaction[]
      ) => {
      if (failWrite) {
        return Promise.reject(new Error("write failed"));
      }

      storedDocument = {
        ...storedDocument,
        transactions: [...updater(storedDocument.transactions)]
      };
      return Promise.resolve([...storedDocument.transactions]);
      }
    )
  };
}

function createExcelBackup(backupDocument: StorageDocument) {
  const rows = [
    "sep=,",
    `schemaVersion,${backupDocument.schemaVersion}`,
    `lastUpdatedAt,${backupDocument.lastUpdatedAt}`,
    "",
    "id,type,date,amount,category,description,paymentMethod,notes,createdAt,updatedAt",
    ...backupDocument.transactions.map((transaction) =>
      [
        transaction.id,
        transaction.type,
        transaction.date,
        transaction.amount,
        transaction.category,
        transaction.description,
        transaction.paymentMethod,
        transaction.notes ?? "",
        transaction.createdAt,
        transaction.updatedAt
      ].join(",")
    )
  ];

  return `${rows.join("\n")}\n`;
}

function createRegionalExcelBackup(backupDocument: StorageDocument) {
  const rows = [
    "sep=;",
    `schemaVersion;${backupDocument.schemaVersion}`,
    `lastUpdatedAt;${backupDocument.lastUpdatedAt}`,
    "",
    "id;type;date;amount;category;description;paymentMethod;notes;createdAt;updatedAt",
    ...backupDocument.transactions.map((transaction) =>
      [
        transaction.id,
        transaction.type,
        "1/8/2026",
        "1.500,50",
        transaction.category,
        transaction.description,
        transaction.paymentMethod,
        transaction.notes ?? "",
        transaction.createdAt,
        transaction.updatedAt
      ].join(";")
    )
  ];

  return `${rows.join("\n")}\n`;
}
