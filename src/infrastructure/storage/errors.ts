export abstract class StorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class StorageUnavailableError extends StorageError {
  constructor(options?: ErrorOptions) {
    super("Storage is unavailable.", options);
  }
}

export class CorruptedDataFileError extends StorageError {
  constructor(options?: ErrorOptions) {
    super("Stored data file is corrupted.", options);
  }
}

export class DataValidationError extends StorageError {
  constructor(options?: ErrorOptions) {
    super("Stored data file does not match the expected schema.", options);
  }
}

export class UnsupportedSchemaVersionError extends StorageError {
  constructor(version: number) {
    super(`Storage schema version ${version} is not supported.`);
  }
}

export class StorageWriteError extends StorageError {
  constructor(options?: ErrorOptions) {
    super("Storage write failed.", options);
  }
}

export class ConcurrentWriteError extends StorageError {
  constructor(options?: ErrorOptions) {
    super("Concurrent storage write failed.", options);
  }
}
