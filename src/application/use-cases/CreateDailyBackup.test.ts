import { describe, expect, it, vi } from "vitest";
import type { BackupRepository, TransactionRepository } from "@application/ports";
import type { StorageDocument } from "@domain/storage";
import { CreateDailyBackup, createDailyBackupFileName } from "./CreateDailyBackup";

const document: StorageDocument = {
  schemaVersion: 1,
  lastUpdatedAt: "2026-08-01T12:00:00.000Z",
  transactions: []
};

describe("CreateDailyBackup", () => {
  it("execute_WhenBackupDoesNotExist_ShouldWriteCompleteDocument", async () => {
    const exists = vi.fn(() => Promise.resolve(false));
    const write = vi.fn(() => Promise.resolve());
    const getDocument = vi.fn(() => Promise.resolve(document));
    const backupRepository = createBackupRepository({ exists, write });
    const transactionRepository = createTransactionRepository({ getDocument });
    const useCase = new CreateDailyBackup({
      backupRepository,
      transactionRepository
    });

    await expect(
      useCase.execute({ backupDate: "2026-08-02" })
    ).resolves.toEqual({
      fileName: "domestic-finance-backup-2026-08-02.json",
      created: true
    });

    expect(getDocument).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(
      "domestic-finance-backup-2026-08-02.json",
      document
    );
  });

  it("execute_WhenBackupAlreadyExists_ShouldNotOverwriteOrReadCurrentDocument", async () => {
    const exists = vi.fn(() => Promise.resolve(true));
    const write = vi.fn(() => Promise.resolve());
    const getDocument = vi.fn(() => Promise.resolve(document));
    const backupRepository = createBackupRepository({ exists, write });
    const transactionRepository = createTransactionRepository({ getDocument });
    const useCase = new CreateDailyBackup({
      backupRepository,
      transactionRepository
    });

    await expect(
      useCase.execute({ backupDate: "2026-08-02" })
    ).resolves.toEqual({
      fileName: "domestic-finance-backup-2026-08-02.json",
      created: false
    });

    expect(getDocument).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it("createDailyBackupFileName_WhenDateIsProvided_ShouldUseStableName", () => {
    expect(createDailyBackupFileName("2026-08-02")).toBe(
      "domestic-finance-backup-2026-08-02.json"
    );
  });
});

function createBackupRepository({
  exists,
  write
}: {
  exists: BackupRepository["exists"];
  write: BackupRepository["write"];
}): BackupRepository {
  return {
    exists,
    write
  };
}

function createTransactionRepository({
  getDocument
}: {
  getDocument: TransactionRepository["getDocument"];
}): TransactionRepository {
  return {
    getAll: vi.fn(() => Promise.resolve([])),
    getDocument,
    replaceDocument: vi.fn(() => Promise.resolve()),
    replaceAll: vi.fn(() => Promise.resolve()),
    updateAll: vi.fn(() => Promise.resolve([]))
  };
}
