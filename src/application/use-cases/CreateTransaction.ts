import {
  validateFinancialTransaction,
  type PaymentMethod,
  type TransactionCategoryKey,
  type TransactionType
} from "@domain/transactions";
import type {
  Clock,
  IdGenerator,
  TransactionRepository
} from "@application/ports";

export interface CreateTransactionInput {
  type: TransactionType;
  date: string;
  amount: number;
  category: TransactionCategoryKey;
  description: string;
  paymentMethod: PaymentMethod;
  notes?: string;
}

export interface CreateTransactionDependencies {
  repository: TransactionRepository;
  clock: Clock;
  idGenerator: IdGenerator;
}

export class CreateTransaction {
  constructor(private readonly dependencies: CreateTransactionDependencies) {}

  async execute(input: CreateTransactionInput) {
    const timestamp = this.dependencies.clock.now();
    const transaction = validateFinancialTransaction({
      ...input,
      id: this.dependencies.idGenerator.generate(),
      createdAt: timestamp,
      updatedAt: timestamp
    });

    if (hasCreateTransaction(this.dependencies.repository)) {
      await this.dependencies.repository.create(transaction);

      return transaction;
    }

    await this.dependencies.repository.updateAll((existingTransactions) => [
      ...existingTransactions,
      transaction
    ]);

    return transaction;
  }
}

function hasCreateTransaction(
  repository: TransactionRepository
): repository is TransactionRepository & {
  create(transaction: ReturnType<typeof validateFinancialTransaction>): Promise<void>;
} {
  return (
    "create" in repository &&
    typeof repository.create === "function"
  );
}
