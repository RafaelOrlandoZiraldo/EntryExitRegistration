export class DomainValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainValidationError";
  }
}

export class TransactionNotFoundError extends Error {
  constructor(id: string) {
    super(`Transaction with id "${id}" was not found.`);
    this.name = "TransactionNotFoundError";
  }
}
