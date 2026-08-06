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
    if (hasGetAndUpdateTransaction(this.dependencies.repository)) {
      const currentTransaction =
        await this.dependencies.repository.getById(input.id);
      const updatedTransaction = validateFinancialTransaction({
        ...input,
        createdAt: currentTransaction.createdAt,
        updatedAt: this.dependencies.clock.now()
      });

      await this.dependencies.repository.update(updatedTransaction);

      return updatedTransaction;
    }

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

function hasGetAndUpdateTransaction(
  repository: TransactionRepository
): repository is TransactionRepository & {
  getById(id: string): Promise<ReturnType<typeof validateFinancialTransaction>>;
  update(transaction: ReturnType<typeof validateFinancialTransaction>): Promise<void>;
} {
  return (
    "getById" in repository &&
    typeof repository.getById === "function" &&
    "update" in repository &&
    typeof repository.update === "function"
  );
}
