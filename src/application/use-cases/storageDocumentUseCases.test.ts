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
      fileName: "domestic-finance-2026-08-20.json",
      document
    });
  });

  it("PreviewImportStorageDocument_WhenFileIsValid_ShouldReturnVersionAndCount", () => {
    const useCase = new PreviewImportStorageDocument();

    expect(useCase.execute(JSON.stringify(document))).toMatchObject({
      schemaVersion: 1,
      transactionCount: 1,
      document
    });
  });

  it("PreviewImportStorageDocument_WhenJsonIsInvalid_ShouldRejectBeforeWrite", () => {
    const useCase = new PreviewImportStorageDocument();

    expect(() => useCase.execute("{bad-json")).toThrow(ImportValidationError);
  });

  it("PreviewImportStorageDocument_WhenVersionIsUnsupported_ShouldRejectBeforeWrite", () => {
    const useCase = new PreviewImportStorageDocument();

    expect(() =>
      useCase.execute(
        JSON.stringify({
          ...document,
          schemaVersion: 99
        })
      )
    ).toThrow(UnsupportedImportVersionError);
  });

  it("ImportStorageDocument_WhenWriteFails_ShouldPreserveCurrentData", async () => {
    const repository = createRepository(document, true);
    const useCase = new ImportStorageDocument({ repository });

    await expect(useCase.execute(JSON.stringify(document))).rejects.toThrow(
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
      storedDocument = {
        ...storedDocument,
        transactions: [...updater(storedDocument.transactions)]
      };
      return Promise.resolve([...storedDocument.transactions]);
      }
    )
  };
}
