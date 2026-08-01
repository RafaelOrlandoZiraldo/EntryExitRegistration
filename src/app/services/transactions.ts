import {
  CreateTransaction,
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
  OpfsTextFileAdapter,
  OpfsTransactionRepository,
  SystemIsoClock
} from "@infrastructure/index";

const clock = new SystemIsoClock();
const transactionRepository = new OpfsTransactionRepository(
  new OpfsTextFileAdapter(),
  clock
);

export const transactionServices = {
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
