import type {
  GetTransactionsPageInput,
  TransactionRepository
} from "@application/ports";

export interface GetTransactionsDependencies {
  repository: TransactionRepository;
}

export class GetTransactions {
  constructor(private readonly dependencies: GetTransactionsDependencies) {}

  async execute(input: GetTransactionsPageInput) {
    return this.dependencies.repository.getPage(input);
  }
}
