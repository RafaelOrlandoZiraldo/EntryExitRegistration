import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";

interface LocalApiEnv {
  AUTH_USERNAME?: string;
  AUTH_PASSWORD_HASH?: string;
  AUTH_PASSWORD_SALT?: string;
  AUTH_PASSWORD_ITERATIONS?: string;
  SESSION_SECRET?: string;
  SESSION_TIMEOUT_MINUTES?: string;
  LOCAL_API_DATA_FILE?: string;
  LOCAL_API_ALLOW_RESET?: string;
}

interface FinancialTransaction {
  id: string;
  type: "income" | "expense";
  date: string;
  amount: number;
  category: string;
  description: string;
  paymentMethod: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface StorageDocument {
  schemaVersion: 1;
  lastUpdatedAt: string;
  transactions: FinancialTransaction[];
}

interface LocalBackup {
  fileName: string;
  createdAt: string;
  document: StorageDocument;
}

interface LocalApiState {
  document: StorageDocument;
  backups: LocalBackup[];
}

interface AuthSession {
  username: string;
  expiresAt: number;
}

const sessionCookieName = "domestic_finance_session";

type NextFunction = (error?: unknown) => void;
type LocalApiMiddleware = (
  request: IncomingMessage,
  response: ServerResponse,
  next: NextFunction
) => void;

export function createLocalApiMiddleware(
  env: LocalApiEnv,
  rootDirectory: string
): LocalApiMiddleware {
  const dataFilePath = path.resolve(
    rootDirectory,
    env.LOCAL_API_DATA_FILE ?? ".local-data/domestic-finance-api.json"
  );

  return (request, response, next) => {
    const url = new URL(request.url ?? "/", "http://localhost");

    if (!url.pathname.startsWith("/api/")) {
      next();
      return;
    }

    void handleLocalApiRequest({
      dataFilePath,
      env,
      method: request.method ?? "GET",
      pathname: url.pathname,
      request,
      response
    }).catch((error: unknown) => {
      console.error("[local-api]", error);
      sendJson(response, 500, { error: "Local API error." });
    });
  };
}

async function handleLocalApiRequest(input: {
  dataFilePath: string;
  env: LocalApiEnv;
  method: string;
  pathname: string;
  request: IncomingMessage;
  response: ServerResponse;
}) {
  const { dataFilePath, env, method, pathname, request, response } = input;

  if (pathname === "/api/test/reset" && method === "DELETE") {
    if (env.LOCAL_API_ALLOW_RESET !== "true") {
      sendJson(response, 404, { error: "Not found." });
      return;
    }

    await writeState(dataFilePath, createEmptyState());
    sendJson(response, 200, { ok: true });
    return;
  }

  if (pathname === "/api/auth/login" && method === "POST") {
    if (!validateAuthConfig(env)) {
      sendJson(response, 500, { error: "Authentication is not configured." });
      return;
    }

    const body = await readJsonBody(request);

    if (
      !isRecord(body) ||
      typeof body.username !== "string" ||
      typeof body.password !== "string" ||
      body.username !== env.AUTH_USERNAME ||
      !verifyPassword(env, body.password)
    ) {
      sendJson(response, 401, { error: "Invalid credentials." });
      return;
    }

    const { session, cookie } = createSessionCookie(env, false);

    sendJson(response, 200, { session }, { "Set-Cookie": cookie });
    return;
  }

  if (pathname === "/api/auth/logout" && method === "POST") {
    sendJson(response, 200, { ok: true }, { "Set-Cookie": clearSessionCookie(false) });
    return;
  }

  if (pathname === "/api/auth/session" && method === "GET") {
    const session = readSession(request, env);

    if (session === null) {
      sendJson(response, 401, { session: null });
      return;
    }

    const refreshed = createSessionCookie(env, false);
    sendJson(
      response,
      200,
      { session: refreshed.session },
      { "Set-Cookie": refreshed.cookie }
    );
    return;
  }

  const session = readSession(request, env);

  if (session === null) {
    sendJson(response, 401, { error: "Unauthorized." });
    return;
  }

  if (pathname === "/api/auth/verify-password" && method === "POST") {
    const body = await readJsonBody(request);

    if (
      !isRecord(body) ||
      typeof body.password !== "string" ||
      !verifyPassword(env, body.password)
    ) {
      sendJson(response, 401, { error: "Invalid credentials." });
      return;
    }

    sendJson(response, 200, { ok: true });
    return;
  }

  if (pathname === "/api/export" && method === "GET") {
    sendJson(response, 200, { document: (await readState(dataFilePath)).document });
    return;
  }

  if (pathname === "/api/import" && method === "POST") {
    const body = await readJsonBody(request);
    const document = isRecord(body) ? readDocument(body.document) : null;

    if (document === null) {
      sendJson(response, 400, { error: "Invalid storage document." });
      return;
    }

    const state = await readState(dataFilePath);
    state.document = document;
    await writeState(dataFilePath, state);
    sendJson(response, 200, { document });
    return;
  }

  if (pathname === "/api/backups/daily" && method === "POST") {
    const body = await readJsonBody(request);

    if (!isRecord(body) || typeof body.backupDate !== "string") {
      sendJson(response, 400, { error: "Invalid backup date." });
      return;
    }

    const state = await readState(dataFilePath);
    const fileName = `domestic-finance-backup-${body.backupDate}.json`;
    const exists = state.backups.some((backup) => backup.fileName === fileName);

    if (!exists) {
      state.backups.push({
        fileName,
        createdAt: new Date().toISOString(),
        document: state.document
      });
      await writeState(dataFilePath, state);
    }

    sendJson(response, 200, { fileName, created: !exists });
    return;
  }

  if (pathname === "/api/transactions" && method === "GET") {
    const state = await readState(dataFilePath);
    sendJson(response, 200, {
      transactions: [...state.document.transactions].sort(sortTransactions)
    });
    return;
  }

  if (pathname === "/api/transactions" && method === "POST") {
    const transaction = readTransaction(await readJsonBody(request));

    if (transaction === null) {
      sendJson(response, 400, { error: "Invalid transaction." });
      return;
    }

    const state = await readState(dataFilePath);
    state.document.transactions.push(transaction);
    state.document.lastUpdatedAt = new Date().toISOString();
    await writeState(dataFilePath, state);
    sendJson(response, 201, { transaction });
    return;
  }

  if (pathname === "/api/transactions" && method === "DELETE") {
    const state = await readState(dataFilePath);
    state.document.transactions = [];
    state.document.lastUpdatedAt = new Date().toISOString();
    await writeState(dataFilePath, state);
    sendJson(response, 200, { ok: true });
    return;
  }

  const transactionRoute = pathname.match(/^\/api\/transactions\/([^/]+)$/);

  if (transactionRoute && method === "PUT") {
    const id = decodeURIComponent(transactionRoute[1]);
    const transaction = readTransaction(await readJsonBody(request));

    if (transaction === null || transaction.id !== id) {
      sendJson(response, 400, { error: "Invalid transaction." });
      return;
    }

    const state = await readState(dataFilePath);
    state.document.transactions = state.document.transactions.map((current) =>
      current.id === id ? transaction : current
    );
    state.document.lastUpdatedAt = new Date().toISOString();
    await writeState(dataFilePath, state);
    sendJson(response, 200, { transaction });
    return;
  }

  if (transactionRoute && method === "DELETE") {
    const id = decodeURIComponent(transactionRoute[1]);
    const state = await readState(dataFilePath);
    state.document.transactions = state.document.transactions.filter(
      (transaction) => transaction.id !== id
    );
    state.document.lastUpdatedAt = new Date().toISOString();
    await writeState(dataFilePath, state);
    sendJson(response, 200, { ok: true });
    return;
  }

  sendJson(response, 405, { error: "Method not allowed." });
}

async function readState(filePath: string): Promise<LocalApiState> {
  try {
    const content = await readFile(filePath, "utf8");
    const parsed = JSON.parse(content) as unknown;

    if (isState(parsed)) {
      return parsed;
    }
  } catch {
    return createEmptyState();
  }

  return createEmptyState();
}

async function writeState(filePath: string, state: LocalApiState) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(state, null, 2), "utf8");
}

function createEmptyState(): LocalApiState {
  return {
    document: {
      schemaVersion: 1,
      lastUpdatedAt: new Date().toISOString(),
      transactions: []
    },
    backups: []
  };
}

function validateAuthConfig(env: LocalApiEnv) {
  const hash = readBase64Bytes(env.AUTH_PASSWORD_HASH);
  const salt = readBase64Bytes(env.AUTH_PASSWORD_SALT);

  return Boolean(
    env.AUTH_USERNAME &&
      env.AUTH_PASSWORD_HASH &&
      env.AUTH_PASSWORD_SALT &&
      env.AUTH_PASSWORD_ITERATIONS &&
      env.SESSION_SECRET &&
      Number.isInteger(Number(env.AUTH_PASSWORD_ITERATIONS)) &&
      Number(env.AUTH_PASSWORD_ITERATIONS) > 0 &&
      Number.isInteger(Number(env.SESSION_TIMEOUT_MINUTES)) &&
      Number(env.SESSION_TIMEOUT_MINUTES) > 0 &&
      hash !== null &&
      hash.byteLength === 32 &&
      salt !== null &&
      salt.byteLength > 0
  );
}

function verifyPassword(env: LocalApiEnv, password: string) {
  if (!validateAuthConfig(env)) {
    return false;
  }

  const expected = readBase64Bytes(env.AUTH_PASSWORD_HASH);
  const salt = readBase64Bytes(env.AUTH_PASSWORD_SALT);

  if (expected === null || salt === null) {
    return false;
  }

  const actual = crypto.pbkdf2Sync(
    password,
    salt,
    Number(env.AUTH_PASSWORD_ITERATIONS),
    32,
    "sha256"
  );

  return (
    actual.byteLength === expected.byteLength &&
    crypto.timingSafeEqual(actual, expected)
  );
}

function createSessionCookie(env: LocalApiEnv, secure: boolean) {
  const timeoutMinutes = Number(env.SESSION_TIMEOUT_MINUTES);
  const session: AuthSession = {
    username: env.AUTH_USERNAME ?? "",
    expiresAt: Date.now() + timeoutMinutes * 60_000
  };
  const payload = base64UrlEncode(JSON.stringify(session));
  const signature = signValue(env.SESSION_SECRET ?? "", payload);

  return {
    session,
    cookie: `${sessionCookieName}=${payload}.${signature}; HttpOnly;${
      secure ? " Secure;" : ""
    } SameSite=Lax; Path=/; Max-Age=${timeoutMinutes * 60}`
  };
}

function clearSessionCookie(secure: boolean) {
  return `${sessionCookieName}=; HttpOnly;${
    secure ? " Secure;" : ""
  } SameSite=Lax; Path=/; Max-Age=0`;
}

function readSession(
  request: IncomingMessage,
  env: LocalApiEnv
): AuthSession | null {
  if (!validateAuthConfig(env)) {
    return null;
  }

  const cookieHeader = request.headers.cookie ?? "";
  const rawValue = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`))
    ?.slice(sessionCookieName.length + 1);

  if (!rawValue) {
    return null;
  }

  const [payload, signature] = rawValue.split(".");

  if (!payload || !signature || signature !== signValue(env.SESSION_SECRET ?? "", payload)) {
    return null;
  }

  try {
    const session = JSON.parse(base64UrlDecode(payload)) as AuthSession;

    if (
      typeof session.username !== "string" ||
      typeof session.expiresAt !== "number" ||
      session.expiresAt <= Date.now()
    ) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

function readTransaction(value: unknown): FinancialTransaction | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    (value.type !== "income" && value.type !== "expense") ||
    typeof value.date !== "string" ||
    typeof value.amount !== "number" ||
    value.amount <= 0 ||
    typeof value.category !== "string" ||
    typeof value.description !== "string" ||
    value.description.trim().length === 0 ||
    typeof value.paymentMethod !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    type: value.type,
    date: value.date,
    amount: value.amount,
    category: value.category,
    description: value.description.trim(),
    paymentMethod: value.paymentMethod,
    ...(typeof value.notes === "string" && value.notes.trim().length > 0
      ? { notes: value.notes.trim() }
      : {}),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  };
}

function readDocument(value: unknown): StorageDocument | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.transactions)) {
    return null;
  }

  const transactions = value.transactions.map(readTransaction);

  if (transactions.some((transaction) => transaction === null)) {
    return null;
  }

  return {
    schemaVersion: 1,
    lastUpdatedAt:
      typeof value.lastUpdatedAt === "string"
        ? value.lastUpdatedAt
        : new Date().toISOString(),
    transactions: transactions as FinancialTransaction[]
  };
}

function isState(value: unknown): value is LocalApiState {
  return (
    isRecord(value) &&
    readDocument(value.document) !== null &&
    Array.isArray(value.backups)
  );
}

function sortTransactions(left: FinancialTransaction, right: FinancialTransaction) {
  return right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readBase64Bytes(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    return Buffer.from(value, "base64");
  } catch {
    return null;
  }
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signValue(secret: string, value: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        resolve(null);
      }
    });
    request.on("error", () => {
      resolve(null);
    });
  });
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {}
) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");

  for (const [name, value] of Object.entries(headers)) {
    response.setHeader(name, value);
  }

  response.end(JSON.stringify(body));
}
