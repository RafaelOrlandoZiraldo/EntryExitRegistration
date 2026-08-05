import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";

interface LocalApiEnv {
  AUTH_USERNAME?: string;
  AUTH_PASSWORD_HASH?: string;
  AUTH_PASSWORD_SALT?: string;
  AUTH_PASSWORD_ITERATIONS?: string;
  AUTH_PASSWORD_ALGORITHM?: string;
  SESSION_SECRET?: string;
  SESSION_TIMEOUT_MINUTES?: string;
  LOCAL_API_DATA_FILE?: string;
  LOCAL_API_ALLOW_RESET?: string;
}

type UserRole = "admin" | "user";

interface LocalUser {
  id: string;
  username: string;
  role: UserRole;
  passwordAlgorithm: "sha256" | "pbkdf2";
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  createdAt: string;
}

interface FinancialTransaction {
  id: string;
  userId?: string;
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
  userId?: string;
  document: StorageDocument;
}

interface LocalApiState {
  document: StorageDocument;
  backups: LocalBackup[];
  users: LocalUser[];
}

interface AuthSession {
  userId: string;
  username: string;
  role: UserRole;
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

    const state = await readState(dataFilePath);
    await ensureBootstrapAdmin(dataFilePath, env, state);
    const body = await readJsonBody(request);
    const user =
      isRecord(body) && typeof body.username === "string"
        ? state.users.find((current) => current.username === body.username)
        : undefined;

    if (
      !user ||
      !isRecord(body) ||
      typeof body.password !== "string" ||
      !verifyPasswordConfig(user, body.password)
    ) {
      sendJson(response, 401, { error: "Invalid credentials." });
      return;
    }

    const { session, cookie } = createSessionCookie(env, user, false);

    sendJson(response, 200, { session }, { "Set-Cookie": cookie });
    return;
  }

  if (pathname === "/api/auth/logout" && method === "POST") {
    sendJson(
      response,
      200,
      { ok: true },
      { "Set-Cookie": clearSessionCookie(false) }
    );
    return;
  }

  if (pathname === "/api/auth/session" && method === "GET") {
    const session = readSession(request, env);

    if (session === null) {
      sendJson(response, 401, { session: null });
      return;
    }

    const refreshed = createSessionCookie(env, session, false);
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

  const state = await readState(dataFilePath);
  await ensureBootstrapAdmin(dataFilePath, env, state);

  if (pathname === "/api/auth/verify-password" && method === "POST") {
    const body = await readJsonBody(request);
    const user = state.users.find((current) => current.id === session.userId);

    if (
      !user ||
      !isRecord(body) ||
      typeof body.password !== "string" ||
      !verifyPasswordConfig(user, body.password)
    ) {
      sendJson(response, 401, { error: "Invalid credentials." });
      return;
    }

    sendJson(response, 200, { ok: true });
    return;
  }

  if (pathname === "/api/users" && method === "GET") {
    if (session.role !== "admin") {
      sendJson(response, 403, { error: "Forbidden." });
      return;
    }

    sendJson(response, 200, {
      users: state.users.map(stripUserSecrets)
    });
    return;
  }

  if (pathname === "/api/users" && method === "POST") {
    if (session.role !== "admin") {
      sendJson(response, 403, { error: "Forbidden." });
      return;
    }

    const body = await readJsonBody(request);

    const username = isRecord(body) && typeof body.username === "string"
      ? body.username.trim()
      : "";
    const password = isRecord(body) && typeof body.password === "string"
      ? body.password
      : "";
    const role = isRecord(body) && body.role === "admin" ? "admin" : "user";

    if (
      !isRecord(body) ||
      typeof body.username !== "string" ||
      typeof body.password !== "string" ||
      (body.role !== "admin" && body.role !== "user") ||
      username.length === 0 ||
      password.length < 8 ||
      state.users.some((user) => user.username === username)
    ) {
      sendJson(response, 400, { error: "Invalid user." });
      return;
    }

    const user: LocalUser = {
      id: crypto.randomUUID(),
      username,
      role,
      ...hashPassword(password),
      createdAt: new Date().toISOString()
    };

    state.users.push(user);
    await writeState(dataFilePath, state);
    sendJson(response, 201, { user: stripUserSecrets(user) });
    return;
  }

  if (pathname === "/api/export" && method === "GET") {
    sendJson(response, 200, { document: getDocumentForSession(state, session) });
    return;
  }

  if (pathname === "/api/import" && method === "POST") {
    if (session.role !== "user") {
      sendJson(response, 403, { error: "Forbidden." });
      return;
    }

    const body = await readJsonBody(request);
    const document = isRecord(body) ? readDocument(body.document) : null;

    if (document === null) {
      sendJson(response, 400, { error: "Invalid storage document." });
      return;
    }

    state.document.transactions = state.document.transactions
      .filter((transaction) => transaction.userId !== session.userId)
      .concat(
        document.transactions.map((transaction) => ({
          ...transaction,
          userId: session.userId
        }))
      );
    state.document.lastUpdatedAt = new Date().toISOString();
    await writeState(dataFilePath, state);
    sendJson(response, 200, { document: getDocumentForSession(state, session) });
    return;
  }

  if (pathname === "/api/backups/daily" && method === "POST") {
    const body = await readJsonBody(request);

    if (!isRecord(body) || typeof body.backupDate !== "string") {
      sendJson(response, 400, { error: "Invalid backup date." });
      return;
    }

    const fileName =
      `domestic-finance-backup-${session.userId}-${body.backupDate}.json`;
    const exists = state.backups.some((backup) => backup.fileName === fileName);

    if (!exists) {
      state.backups.push({
        fileName,
        createdAt: new Date().toISOString(),
        userId: session.userId,
        document: getDocumentForSession(state, session)
      });
      await writeState(dataFilePath, state);
    }

    sendJson(response, 200, { fileName, created: !exists });
    return;
  }

  if (pathname === "/api/transactions" && method === "GET") {
    sendJson(response, 200, {
      transactions: getTransactionsForSession(state, session)
    });
    return;
  }

  if (pathname === "/api/transactions" && method === "POST") {
    if (session.role !== "user") {
      sendJson(response, 403, { error: "Forbidden." });
      return;
    }

    const transaction = readTransaction(await readJsonBody(request));

    if (transaction === null) {
      sendJson(response, 400, { error: "Invalid transaction." });
      return;
    }

    const nextTransaction = { ...transaction, userId: session.userId };
    state.document.transactions.push(nextTransaction);
    state.document.lastUpdatedAt = new Date().toISOString();
    await writeState(dataFilePath, state);
    sendJson(response, 201, { transaction: nextTransaction });
    return;
  }

  if (pathname === "/api/transactions" && method === "DELETE") {
    if (session.role !== "admin") {
      sendJson(response, 403, { error: "Forbidden." });
      return;
    }

    state.document.transactions = [];
    state.document.lastUpdatedAt = new Date().toISOString();
    await writeState(dataFilePath, state);
    sendJson(response, 200, { ok: true });
    return;
  }

  const transactionRoute = pathname.match(/^\/api\/transactions\/([^/]+)$/);

  if (transactionRoute && method === "PUT") {
    if (session.role !== "user") {
      sendJson(response, 403, { error: "Forbidden." });
      return;
    }

    const id = decodeURIComponent(transactionRoute[1]);
    const transaction = readTransaction(await readJsonBody(request));

    if (transaction === null || transaction.id !== id) {
      sendJson(response, 400, { error: "Invalid transaction." });
      return;
    }

    state.document.transactions = state.document.transactions.map((current) =>
      current.id === id && current.userId === session.userId
        ? { ...transaction, userId: session.userId }
        : current
    );
    state.document.lastUpdatedAt = new Date().toISOString();
    await writeState(dataFilePath, state);
    sendJson(response, 200, {
      transaction: { ...transaction, userId: session.userId }
    });
    return;
  }

  if (transactionRoute && method === "DELETE") {
    if (session.role !== "user") {
      sendJson(response, 403, { error: "Forbidden." });
      return;
    }

    const id = decodeURIComponent(transactionRoute[1]);
    state.document.transactions = state.document.transactions.filter(
      (transaction) =>
        transaction.id !== id || transaction.userId !== session.userId
    );
    state.document.lastUpdatedAt = new Date().toISOString();
    await writeState(dataFilePath, state);
    sendJson(response, 200, { ok: true });
    return;
  }

  sendJson(response, 405, { error: "Method not allowed." });
}

async function ensureBootstrapAdmin(
  filePath: string,
  env: LocalApiEnv,
  state: LocalApiState
) {
  if (
    !validateAuthConfig(env) ||
    state.users.some((user) => user.username === env.AUTH_USERNAME)
  ) {
    return;
  }

  state.users.push({
    id: "admin-user",
    username: env.AUTH_USERNAME ?? "admin",
    role: "admin",
    passwordAlgorithm:
      env.AUTH_PASSWORD_ALGORITHM === "pbkdf2" ? "pbkdf2" : "sha256",
    passwordHash: env.AUTH_PASSWORD_HASH ?? "",
    passwordSalt: env.AUTH_PASSWORD_SALT ?? "",
    passwordIterations: Number(env.AUTH_PASSWORD_ITERATIONS),
    createdAt: new Date().toISOString()
  });
  await writeState(filePath, state);
}

async function readState(filePath: string): Promise<LocalApiState> {
  try {
    const content = await readFile(filePath, "utf8");
    const parsed = JSON.parse(content) as unknown;

    if (isState(parsed)) {
      return {
        ...parsed,
        users: parsed.users ?? [],
        document: {
          ...parsed.document,
          transactions: parsed.document.transactions
        }
      };
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
    backups: [],
    users: []
  };
}

function validateAuthConfig(env: LocalApiEnv) {
  const hash = readBase64Bytes(env.AUTH_PASSWORD_HASH);
  const salt = readBase64Bytes(env.AUTH_PASSWORD_SALT);
  const algorithm = getPasswordAlgorithm(env);

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
      salt.byteLength > 0 &&
      algorithm !== null
  );
}

function verifyPasswordConfig(user: LocalUser, password: string) {
  const expected = readBase64Bytes(user.passwordHash);
  const salt = readBase64Bytes(user.passwordSalt);

  if (expected === null || salt === null) {
    return false;
  }

  const actual =
    user.passwordAlgorithm === "pbkdf2"
      ? crypto.pbkdf2Sync(password, salt, user.passwordIterations, 32, "sha256")
      : crypto.createHash("sha256").update(salt).update(password).digest();

  return (
    actual.byteLength === expected.byteLength &&
    crypto.timingSafeEqual(actual, expected)
  );
}

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.createHash("sha256").update(salt).update(password).digest();

  return {
    passwordAlgorithm: "sha256" as const,
    passwordHash: hash.toString("base64"),
    passwordSalt: salt.toString("base64"),
    passwordIterations: 310000
  };
}

function getPasswordAlgorithm(env: LocalApiEnv) {
  const algorithm = env.AUTH_PASSWORD_ALGORITHM ?? "sha256";

  return algorithm === "sha256" || algorithm === "pbkdf2" ? algorithm : null;
}

function createSessionCookie(
  env: LocalApiEnv,
  user: { id?: string; userId?: string; username: string; role: UserRole },
  secure: boolean
) {
  const timeoutMinutes = Number(env.SESSION_TIMEOUT_MINUTES);
  const session: AuthSession = {
    userId: user.id ?? user.userId ?? "",
    username: user.username,
    role: user.role,
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

  if (
    !payload ||
    !signature ||
    signature !== signValue(env.SESSION_SECRET ?? "", payload)
  ) {
    return null;
  }

  try {
    const session = JSON.parse(base64UrlDecode(payload)) as AuthSession;

    if (
      typeof session.userId !== "string" ||
      typeof session.username !== "string" ||
      (session.role !== "admin" && session.role !== "user") ||
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

function getTransactionsForSession(
  state: LocalApiState,
  session: AuthSession
) {
  return state.document.transactions
    .filter(
      (transaction) =>
        session.role === "admin" || transaction.userId === session.userId
    )
    .sort(sortTransactions);
}

function getDocumentForSession(
  state: LocalApiState,
  session: AuthSession
): StorageDocument {
  return {
    schemaVersion: 1,
    lastUpdatedAt: state.document.lastUpdatedAt,
    transactions: getTransactionsForSession(state, session)
  };
}

function stripUserSecrets(user: LocalUser) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt
  };
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
    ...(typeof value.userId === "string" ? { userId: value.userId } : {}),
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
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.transactions)
  ) {
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
    Array.isArray(value.backups) &&
    (!("users" in value) || Array.isArray(value.users))
  );
}

function sortTransactions(
  left: FinancialTransaction,
  right: FinancialTransaction
) {
  return (
    right.date.localeCompare(left.date) ||
    right.createdAt.localeCompare(left.createdAt)
  );
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
