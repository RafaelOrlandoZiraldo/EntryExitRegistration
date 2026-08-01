import {
  currentStorageSchemaVersion,
  storageDocumentSchema,
  type StorageDocument
} from "@domain/storage";
import {
  DataValidationError,
  UnsupportedSchemaVersionError
} from "./errors";

type Migration = (document: unknown) => unknown;

const migrations = new Map<number, Migration>();

export function migrateStorageDocument(document: unknown): StorageDocument {
  const version = readSchemaVersion(document);

  if (version > currentStorageSchemaVersion) {
    throw new UnsupportedSchemaVersionError(version);
  }

  let migratedDocument = document;

  for (
    let nextVersion = version + 1;
    nextVersion <= currentStorageSchemaVersion;
    nextVersion += 1
  ) {
    const migration = migrations.get(nextVersion);

    if (migration === undefined) {
      throw new UnsupportedSchemaVersionError(version);
    }

    migratedDocument = migration(migratedDocument);
  }

  const result = storageDocumentSchema.safeParse(migratedDocument);

  if (!result.success) {
    throw new DataValidationError({ cause: result.error });
  }

  return result.data;
}

function readSchemaVersion(document: unknown) {
  if (
    typeof document !== "object" ||
    document === null ||
    !("schemaVersion" in document) ||
    typeof document.schemaVersion !== "number" ||
    !Number.isInteger(document.schemaVersion)
  ) {
    throw new DataValidationError();
  }

  return document.schemaVersion;
}
