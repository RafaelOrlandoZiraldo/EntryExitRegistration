import {
  TransactionNotFoundError,
  validateFinancialTransaction,
  type PaymentMethod,
  type TransactionCategoryKey,
  type TransactionType
} from "@domain/index";
import type { Clock, TransactionRepository } from "@application/ports";

export interface UpdateTransactionInput {
  id: string;
  type: TransactionType;
  date: string;
  amount: number;
  category: TransactionCategoryKey;
  description: string;
  paymentMethod: PaymentMethod;
  notes?: string;
}

export interface UpdateTransactionDependencies {
  repository: TransactionRepository;
  clock: Clock;
}

export class UpdateTransaction {
  constructor(private readonly dependencies: UpdateTransactionDependencies) {}

  async execute(input: UpdateTransactionInput) {
    let updatedTransaction:
      | ReturnType<typeof validateFinancialTransaction>
      | undefined;

    await this.dependencies.repository.updateAll((existingTransactions) => {
      const transactionIndex = existingTransactions.findIndex(
        (transaction) => transaction.id === input.id
      );

      if (transactionIndex === -1) {
        throw new TransactionNotFoundError(input.id);
      }

      const currentTransaction = existingTransactions[transactionIndex];
      updatedTransaction = validateFinancialTransaction({
        ...input,
        createdAt: currentTransaction.createdAt,
        updatedAt: this.dependencies.clock.now()
      });

      return existingTransactions.map((transaction) =>
        transaction.id === input.id ? updatedTransaction : transaction
      );
    });

    if (updatedTransaction === undefined) {
      throw new TransactionNotFoundError(input.id);
    }

    return updatedTransaction;
  }
}
