import type { TransactionRepository } from "@application/ports";
import type { Clock } from "@application/ports";
import {
  currentStorageSchemaVersion,
  storageDocumentSchema,
  type StorageDocument
} from "@domain/storage";

export class ImportValidationError extends Error {
  constructor(message = "Import file is not valid.", options?: ErrorOptions) {
    super(message, options);
    this.name = "ImportValidationError";
  }
}

export class UnsupportedImportVersionError extends Error {
  constructor(readonly version: number) {
    super(`Import schema version ${version} is not supported.`);
    this.name = "UnsupportedImportVersionError";
  }
}

export interface ExportStorageDocumentResult {
  fileName: string;
  contents: string;
  document: StorageDocument;
}

export interface ImportPreview {
  schemaVersion: number;
  transactionCount: number;
  document: StorageDocument;
}

export class ExportStorageDocument {
  constructor(
    private readonly dependencies: {
      repository: TransactionRepository;
      clock: Clock;
    }
  ) {}

  async execute(): Promise<ExportStorageDocumentResult> {
    const document = await this.dependencies.repository.getDocument();
    const date = this.dependencies.clock.now().slice(0, 10);

    return {
      fileName: `domestic-finance-${date}.json`,
      contents: `${JSON.stringify(document, null, 2)}\n`,
      document
    };
  }
}

export class PreviewImportStorageDocument {
  execute(contents: string): ImportPreview {
    const document = parseImportStorageDocument(contents);

    return {
      schemaVersion: document.schemaVersion,
      transactionCount: document.transactions.length,
      document
    };
  }
}

export class ImportStorageDocument {
  constructor(
    private readonly dependencies: {
      repository: TransactionRepository;
    }
  ) {}

  async execute(contents: string): Promise<StorageDocument> {
    const document = parseImportStorageDocument(contents);

    await this.dependencies.repository.replaceDocument(document);

    return document;
  }
}

export function parseImportStorageDocument(contents: string): StorageDocument {
  let parsed: unknown;

  try {
    parsed = JSON.parse(contents) as unknown;
  } catch (error) {
    throw new ImportValidationError("Import file is not valid JSON.", {
      cause: error
    });
  }

  const version = readImportSchemaVersion(parsed);

  if (version > currentStorageSchemaVersion) {
    throw new UnsupportedImportVersionError(version);
  }

  const result = storageDocumentSchema.safeParse(parsed);

  if (!result.success) {
    throw new ImportValidationError("Import file does not match the schema.", {
      cause: result.error
    });
  }

  return result.data;
}

function readImportSchemaVersion(document: unknown) {
  if (
    typeof document !== "object" ||
    document === null ||
    !("schemaVersion" in document) ||
    typeof document.schemaVersion !== "number" ||
    !Number.isInteger(document.schemaVersion)
  ) {
    throw new ImportValidationError("Import file is missing schema version.");
  }

  return document.schemaVersion;
}
