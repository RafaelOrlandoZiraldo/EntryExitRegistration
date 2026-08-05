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
      fileName: `domestic-finance-${date}.csv`,
      contents: serializeStorageDocumentForExcel(document),
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
    const mergedTransactions = await this.dependencies.repository.updateAll(
      (existingTransactions) => {
        const existingIds = new Set(
          existingTransactions.map((transaction) => transaction.id)
        );
        const newTransactions = document.transactions.filter(
          (transaction) => !existingIds.has(transaction.id)
        );

        return [...existingTransactions, ...newTransactions];
      }
    );

    return {
      ...document,
      transactions: mergedTransactions
    };
  }
}

export function parseImportStorageDocument(contents: string): StorageDocument {
  const document = parseExcelStorageDocument(contents);
  const version = readImportSchemaVersion(document);

  if (version !== currentStorageSchemaVersion) {
    throw new UnsupportedImportVersionError(version);
  }

  const result = storageDocumentSchema.safeParse(document);

  if (!result.success) {
    throw new ImportValidationError("Import file does not match the schema.", {
      cause: result.error
    });
  }

  return result.data;
}

const excelHeaders = [
  "id",
  "type",
  "date",
  "amount",
  "category",
  "description",
  "paymentMethod",
  "notes",
  "createdAt",
  "updatedAt"
] as const;

function serializeStorageDocumentForExcel(document: StorageDocument) {
  const rows = [
    ["schemaVersion", String(document.schemaVersion)],
    ["lastUpdatedAt", document.lastUpdatedAt],
    [],
    [...excelHeaders],
    ...document.transactions.map((transaction) =>
      excelHeaders.map((header) => {
        const value = transaction[header];
        return value === undefined ? "" : String(value);
      })
    )
  ];

  return `sep=,\n${rows.map(serializeCsvRow).join("\n")}\n`;
}

function parseExcelStorageDocument(contents: string): StorageDocument {
  const normalizedContents = contents.replace(/^\uFEFF/, "");
  const delimiter = detectCsvDelimiter(normalizedContents);
  const rows = parseCsvRows(normalizedContents, delimiter);
  const effectiveRows =
    rows[0] && isExcelSeparatorDirective(rows[0])
      ? rows.slice(1)
      : rows;
  const schemaVersionRow = effectiveRows[0];
  const lastUpdatedAtRow = effectiveRows[1];
  const headerIndex = effectiveRows.findIndex(
    (row) => excelHeaders.every((header, index) => row[index] === header)
  );

  if (
    schemaVersionRow?.[0] !== "schemaVersion" ||
    lastUpdatedAtRow?.[0] !== "lastUpdatedAt" ||
    headerIndex < 0
  ) {
    throw new ImportValidationError("Import file does not match the Excel format.");
  }

  const schemaVersion = Number(schemaVersionRow[1]);

  if (!Number.isInteger(schemaVersion)) {
    throw new ImportValidationError("Import file is missing schema version.");
  }

  return {
    schemaVersion,
    lastUpdatedAt: lastUpdatedAtRow[1] ?? "",
    transactions: effectiveRows
      .slice(headerIndex + 1)
      .filter((row) => row.some((cell) => cell.trim() !== ""))
      .map((row) => ({
        id: readRequiredCell(row, 0),
        type: readRequiredCell(row, 1),
        date: readDateCell(row, 2),
        amount: readAmountCell(row, 3),
        category: readRequiredCell(row, 4),
        description: readRequiredCell(row, 5),
        paymentMethod: readRequiredCell(row, 6),
        notes: readOptionalCell(row, 7),
        createdAt: readRequiredCell(row, 8),
        updatedAt: readRequiredCell(row, 9)
      }))
  };
}

function isExcelSeparatorDirective(row: readonly string[]) {
  return (
    row.length <= 2 &&
    row.join("").toLowerCase().startsWith("sep=")
  );
}

function serializeCsvRow(row: readonly string[]) {
  return row.map(serializeCsvCell).join(",");
}

function serializeCsvCell(value: string) {
  if (!/[",\r\n]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, "\"\"")}"`;
}

function detectCsvDelimiter(contents: string) {
  const firstLine = contents.split(/\r?\n/, 1)[0]?.trim() ?? "";
  const separatorDirective = /^sep=(.)$/i.exec(firstLine);

  if (separatorDirective) {
    return separatorDirective[1];
  }

  const sampleLines = contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);
  const candidates = [",", ";", "\t", "|"];
  const bestCandidate = candidates
    .map((candidate) => ({
      delimiter: candidate,
      score: sampleLines.reduce(
        (total, line) => total + countDelimiterOutsideQuotes(line, candidate),
        0
      )
    }))
    .sort((left, right) => right.score - left.score)[0];

  return bestCandidate && bestCandidate.score > 0 ? bestCandidate.delimiter : ",";
}

function countDelimiterOutsideQuotes(line: string, delimiter: string) {
  let count = 0;
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === "\"" && insideQuotes && nextChar === "\"") {
      index += 1;
    } else if (char === "\"") {
      insideQuotes = !insideQuotes;
    } else if (!insideQuotes && char === delimiter) {
      count += 1;
    }
  }

  return count;
}

function parseCsvRows(contents: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let insideQuotes = false;

  for (let index = 0; index < contents.length; index += 1) {
    const char = contents[index];
    const nextChar = contents[index + 1];

    if (insideQuotes) {
      if (char === "\"" && nextChar === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        insideQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === "\"") {
      insideQuotes = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (insideQuotes) {
    throw new ImportValidationError("Import file has an unterminated quoted cell.");
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

function readRequiredCell(row: readonly string[], index: number) {
  return row[index] ?? "";
}

function readOptionalCell(row: readonly string[], index: number) {
  const value = row[index]?.trim();

  return value ? value : undefined;
}

function readDateCell(row: readonly string[], index: number) {
  const value = readRequiredCell(row, index).trim();
  const isoDateMatch = /^\d{4}-\d{2}-\d{2}$/.exec(value);

  if (isoDateMatch) {
    return value;
  }

  const regionalDateMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);

  if (!regionalDateMatch) {
    return value;
  }

  const [, day, month, year] = regionalDateMatch;

  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function readAmountCell(row: readonly string[], index: number) {
  const value = parseLocalizedNumber(row[index] ?? "");

  if (!Number.isFinite(value)) {
    throw new ImportValidationError("Import file has an invalid amount.");
  }

  return value;
}

function parseLocalizedNumber(rawValue: string) {
  const value = rawValue
    .trim()
    .replace(/\s/g, "")
    .replace(/^\$/, "");

  if (!value) {
    return Number.NaN;
  }

  const commaIndex = value.lastIndexOf(",");
  const dotIndex = value.lastIndexOf(".");

  if (commaIndex >= 0 && dotIndex >= 0) {
    const decimalSeparator = commaIndex > dotIndex ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";

    return Number(
      value
        .replace(new RegExp(`\\${thousandsSeparator}`, "g"), "")
        .replace(decimalSeparator, ".")
    );
  }

  if (commaIndex >= 0) {
    return Number(normalizeSingleSeparatorNumber(value, ","));
  }

  if (dotIndex >= 0) {
    return Number(normalizeSingleSeparatorNumber(value, "."));
  }

  return Number(value);
}

function normalizeSingleSeparatorNumber(value: string, separator: "," | ".") {
  const parts = value.split(separator);
  const lastPart = parts[parts.length - 1];
  const shouldTreatAsThousands =
    parts.length > 2 || (lastPart.length === 3 && parts[0].length <= 3);

  if (shouldTreatAsThousands) {
    return parts.join("");
  }

  return parts.join(".");
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
