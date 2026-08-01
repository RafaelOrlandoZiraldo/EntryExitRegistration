import { describe, expect, it } from "vitest";
import { DomainValidationError, TransactionNotFoundError } from "@domain/errors";
import type { StorageDocument } from "@domain/storage";
import type { FinancialTransaction } from "@domain/transactions";
import type { Clock, IdGenerator, TransactionRepository } from "@application/ports";
import {
  CreateTransaction,
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

  it("GetTransactions_WhenTransactionsExist_ShouldReturnRepositoryData", async () => {
    const repository = new FakeTransactionRepository([existingTransaction]);
    const useCase = new GetTransactions({ repository });

    await expect(useCase.execute()).resolves.toEqual([existingTransaction]);
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
