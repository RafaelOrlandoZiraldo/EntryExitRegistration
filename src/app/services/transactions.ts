import {
  CreateDailyBackup,
  CreateTransaction,
  DeleteAllTransactions,
  DeleteTransaction,
  ExportStorageDocument,
  GetTransactions,
  ImportStorageDocument,
  PreviewImportStorageDocument,
  UpdateTransaction,
  type CreateDailyBackupInput,
  type CreateDailyBackupResult
} from "@application/use-cases";
import {
  BrowserFileDownloadAdapter,
  BrowserIdGenerator,
  HttpTransactionRepository,
  OpfsBackupRepository,
  OpfsTextFileAdapter,
  OpfsTransactionRepository,
  SystemIsoClock
} from "@infrastructure/index";

const clock = new SystemIsoClock();
const useApiBackend = import.meta.env.VITE_DATA_SOURCE === "api";

const localTextFileAdapter = useApiBackend ? null : new OpfsTextFileAdapter();
const transactionRepository = useApiBackend
  ? new HttpTransactionRepository()
  : new OpfsTransactionRepository(localTextFileAdapter, clock);
const backupRepository = localTextFileAdapter
  ? new OpfsBackupRepository(localTextFileAdapter)
  : null;

export const transactionServices = {
  createDailyBackup: useApiBackend
    ? new HttpDailyBackupUseCase()
    : new CreateDailyBackup({
        backupRepository,
        transactionRepository
      }),
  getTransactions: new GetTransactions({
    repository: transactionRepository
  }),
  createTransaction: new CreateTransaction({
    repository: transactionRepository,
    clock,
    idGenerator: new BrowserIdGenerator()
  }),
  updateTransaction: new UpdateTransaction({
    repository: transactionRepository,
    clock
  }),
  deleteTransaction: new DeleteTransaction({
    repository: transactionRepository
  }),
  deleteAllTransactions: new DeleteAllTransactions({
    repository: transactionRepository
  }),
  exportStorageDocument: new ExportStorageDocument({
    repository: transactionRepository,
    clock
  }),
  previewImportStorageDocument: new PreviewImportStorageDocument(),
  importStorageDocument: new ImportStorageDocument({
    repository: transactionRepository
  }),
  downloadFile: new BrowserFileDownloadAdapter()
};

class HttpDailyBackupUseCase {
  async execute(
    input: CreateDailyBackupInput
  ): Promise<CreateDailyBackupResult> {
    const response = await fetch("/api/backups/daily", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new Error("Daily backup request failed.");
    }

    return (await response.json()) as CreateDailyBackupResult;
  }
}
