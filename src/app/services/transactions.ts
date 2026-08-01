import {
  CreateDailyBackup,
  CreateTransaction,
  DeleteAllTransactions,
  DeleteTransaction,
  ExportStorageDocument,
  GetTransactions,
  ImportStorageDocument,
  PreviewImportStorageDocument,
  UpdateTransaction
} from "@application/use-cases";
import {
  BrowserFileDownloadAdapter,
  BrowserIdGenerator,
  OpfsBackupRepository,
  OpfsTextFileAdapter,
  OpfsTransactionRepository,
  SystemIsoClock
} from "@infrastructure/index";

const clock = new SystemIsoClock();
const textFileAdapter = new OpfsTextFileAdapter();
const transactionRepository = new OpfsTransactionRepository(
  textFileAdapter,
  clock
);
const backupRepository = new OpfsBackupRepository(textFileAdapter);

export const transactionServices = {
  createDailyBackup: new CreateDailyBackup({
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
