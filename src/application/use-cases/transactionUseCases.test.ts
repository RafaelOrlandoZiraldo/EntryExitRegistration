import { describe, expect, it } from "vitest";
import { DomainValidationError, TransactionNotFoundError } from "@domain/errors";
import type { StorageDocument } from "@domain/storage";
import {
  calculateFinancialSummary,
  groupExpensesByCategory,
  searchTransactions,
  type FinancialTransaction
} from "@domain/transactions";
import type { Clock, IdGenerator, TransactionRepository } from "@application/ports";
import {
  CreateTransaction,
  DeleteAllTransactions,
  DeleteTransaction,
  GetTransactions,
  SearchTransactions,
  UpdateTransaction
} from "./index";

class FakeTransactionRepository implements TransactionRepository {
  public transactions: FinancialTransaction[];
  public replaceCount = 0;

  constructor(initialTransactions: FinancialTransaction[] = []) {
    this.transactions = [...initialTransactions];
  }

  getAll() {
    return Promise.resolve([...this.transactions]);
  }

  getPage({
    pageIndex,
    pageSize,
    filters,
    sort
  }: Parameters<TransactionRepository["getPage"]>[0]) {
    const transactions = searchTransactions(this.transactions, {
      filters,
      sort
    });
    const start = pageIndex * pageSize;

    return Promise.resolve({
      transactions: transactions.slice(start, start + pageSize),
      total: transactions.length,
      dashboard: {
        summary: calculateFinancialSummary(transactions),
        expenseDistribution: groupExpensesByCategory(transactions)
      }
    });
  }

  getDocument() {
    return Promise.resolve({
      schemaVersion: 1,
      lastUpdatedAt: fixedClock.now(),
      transactions: [...this.transactions]
    } satisfies StorageDocument);
  }

  replaceDocument(document: StorageDocument) {
    this.transactions = [...document.transactions];
    this.replaceCount += 1;
    return Promise.resolve();
  }

  replaceAll(transactions: readonly FinancialTransaction[]) {
    this.transactions = [...transactions];
    this.replaceCount += 1;
    return Promise.resolve();
  }

  updateAll(
    updater: (
      transactions: readonly FinancialTransaction[]
    ) => readonly FinancialTransaction[]
  ) {
    this.transactions = [...updater(this.transactions)];
    this.replaceCount += 1;
    return Promise.resolve([...this.transactions]);
  }
}

const fixedClock: Clock = {
  now: () => "2026-08-20T12:00:00.000Z"
};

const fixedIdGenerator: IdGenerator = {
  generate: () => "generated-id"
};

const existingTransaction: FinancialTransaction = {
  id: "existing-id",
  type: "expense",
  date: "2026-08-10",
  amount: 150,
  category: "transport",
  description: "Taxi",
  paymentMethod: "digital_wallet",
  createdAt: "2026-08-10T09:00:00.000Z",
  updatedAt: "2026-08-10T09:00:00.000Z"
};

describe("transaction use cases", () => {
  it("CreateTransaction_WhenInputIsValid_ShouldPersistAndReturnTransaction", async () => {
    const repository = new FakeTransactionRepository();
    const useCase = new CreateTransaction({
      repository,
      clock: fixedClock,
      idGenerator: fixedIdGenerator
    });

    const result = await useCase.execute({
      type: "income",
      date: "2026-08-20",
      amount: 1000,
      category: "sale",
      description: "Venta usada",
      paymentMethod: "cash"
    });

    expect(result).toEqual({
      id: "generated-id",
      type: "income",
      date: "2026-08-20",
      amount: 1000,
      category: "sale",
      description: "Venta usada",
      paymentMethod: "cash",
      createdAt: "2026-08-20T12:00:00.000Z",
      updatedAt: "2026-08-20T12:00:00.000Z"
    });
    expect(repository.transactions).toEqual([result]);
  });

  it("CreateTransaction_WhenDescriptionIsBlank_ShouldRejectWithoutPersisting", async () => {
    const repository = new FakeTransactionRepository();
    const useCase = new CreateTransaction({
      repository,
      clock: fixedClock,
      idGenerator: fixedIdGenerator
    });

    await expect(
      useCase.execute({
        type: "income",
        date: "2026-08-20",
        amount: 1000,
        category: "sale",
        description: "   ",
        paymentMethod: "cash"
      })
    ).rejects.toThrow(DomainValidationError);
    expect(repository.replaceCount).toBe(0);
  });

  it("UpdateTransaction_WhenInputIsValid_ShouldPreserveCreatedAtAndRefreshUpdatedAt", async () => {
    const repository = new FakeTransactionRepository([existingTransaction]);
    const useCase = new UpdateTransaction({
      repository,
      clock: fixedClock
    });

    const result = await useCase.execute({
      id: "existing-id",
      type: "expense",
      date: "2026-08-11",
      amount: 175,
      category: "transport",
      description: "Taxi editado",
      paymentMethod: "digital_wallet"
    });

    expect(result.createdAt).toBe("2026-08-10T09:00:00.000Z");
    expect(result.updatedAt).toBe("2026-08-20T12:00:00.000Z");
    expect(repository.transactions).toEqual([result]);
  });

  it("UpdateTransaction_WhenTransactionDoesNotExist_ShouldReject", async () => {
    const repository = new FakeTransactionRepository([existingTransaction]);
    const useCase = new UpdateTransaction({
      repository,
      clock: fixedClock
    });

    await expect(
      useCase.execute({
        id: "missing-id",
        type: "expense",
        date: "2026-08-11",
        amount: 175,
        category: "transport",
        description: "Taxi editado",
        paymentMethod: "digital_wallet"
      })
    ).rejects.toThrow(TransactionNotFoundError);
  });

  it("DeleteTransaction_WhenTransactionExists_ShouldPhysicallyRemoveIt", async () => {
    const repository = new FakeTransactionRepository([existingTransaction]);
    const useCase = new DeleteTransaction({ repository });

    await useCase.execute("existing-id");

    expect(repository.transactions).toEqual([]);
  });

  it("DeleteAllTransactions_WhenTransactionsExist_ShouldPhysicallyRemoveEveryTransaction", async () => {
    const repository = new FakeTransactionRepository([
      existingTransaction,
      { ...existingTransaction, id: "second-id" }
    ]);
    const useCase = new DeleteAllTransactions({ repository });

    await useCase.execute();

    expect(repository.transactions).toEqual([]);
    expect(repository.replaceCount).toBe(1);
  });

  it("GetTransactions_WhenTransactionsExist_ShouldReturnRepositoryData", async () => {
    const repository = new FakeTransactionRepository([existingTransaction]);
    const useCase = new GetTransactions({ repository });

    await expect(
      useCase.execute({ pageIndex: 0, pageSize: 10 })
    ).resolves.toEqual({
      transactions: [existingTransaction],
      total: 1,
      dashboard: {
        summary: calculateFinancialSummary([existingTransaction]),
        expenseDistribution: groupExpensesByCategory([existingTransaction])
      }
    });
  });

  it("SearchTransactions_WhenCriteriaMatch_ShouldReturnFilteredTransactions", async () => {
    const repository = new FakeTransactionRepository([
      existingTransaction,
      {
        ...existingTransaction,
        id: "income-id",
        type: "income",
        category: "salary",
        amount: 3000,
        description: "Sueldo"
      }
    ]);
    const useCase = new SearchTransactions({ repository });

    const result = await useCase.execute({
      filters: { type: "expense", category: "transport" }
    });

    expect(result).toEqual([existingTransaction]);
  });
});
