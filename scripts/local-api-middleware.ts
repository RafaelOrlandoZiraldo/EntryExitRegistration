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

type UserRole = "admin" | "user" | "seller";

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

interface SalesProfile {
  userId: string;
  catalogUserId: string;
  commissionRate: number;
  bonusGoalAmount: number;
  bonusAmount: number;
  createdAt: string;
  updatedAt: string;
}

interface SalesProfileInput {
  catalogUserId: string;
  commissionRate: number;
  bonusGoalAmount: number;
  bonusAmount: number;
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

interface CatalogCategory {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

interface CatalogArticle {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  sku?: string;
  description?: string;
  unit?: string;
  price?: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

interface CatalogArticleInput {
  name: string;
  categoryId: string;
  sku?: string;
  description?: string;
  unit?: string;
  price?: number;
  active?: boolean;
}

interface Client {
  id: string;
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

interface ClientInput {
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  active?: boolean;
}

interface Supplier {
  id: string;
  name: string;
  taxId?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  paymentTerms?: string;
  bankAccount?: string;
  category?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

interface SupplierInput {
  name: string;
  taxId?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  paymentTerms?: string;
  bankAccount?: string;
  category?: string;
  notes?: string;
  active?: boolean;
}

type InventoryMovementType = "in" | "out" | "adjustment";

interface InventoryMovement {
  id: string;
  articleId: string;
  type: InventoryMovementType;
  quantity: number;
  reason: string;
  notes?: string;
  createdAt: string;
  userId?: string;
}

interface InventoryMovementInput {
  articleId: string;
  type: InventoryMovementType;
  quantity: number;
  reason: string;
  notes?: string;
}

type OrderStatus = "pending" | "confirmed" | "delivered" | "cancelled";

interface OrderItem {
  id: string;
  orderId: string;
  articleId: string;
  articleName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface Order {
  id: string;
  orderNumber: string;
  customerId?: string;
  customerName: string;
  status: OrderStatus;
  paymentMethod: string;
  totalAmount: number;
  notes?: string;
  transactionId: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
  items: OrderItem[];
}

interface OrderInput {
  customerId: string;
  status: OrderStatus;
  paymentMethod: string;
  notes?: string;
  items: Array<{
    articleId: string;
    quantity: number;
  }>;
}

type PurchaseOrderStatus = "draft" | "sent" | "received" | "cancelled";

interface PurchaseOrderItem {
  id: string;
  articleId: string;
  quantity: number;
  unitCost: number;
  notes?: string;
}

interface PurchaseOrderItemInput {
  articleId: string;
  quantity: number;
  unitCost: number;
  notes?: string;
}

interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId?: string;
  supplierName: string;
  supplierContact?: string;
  expectedDate?: string;
  status: PurchaseOrderStatus;
  paymentTerms?: string;
  notes?: string;
  items: PurchaseOrderItem[];
  createdAt: string;
  updatedAt: string;
  receivedAt?: string;
  inventoryPostedAt?: string;
  userId?: string;
}

interface PurchaseOrderInput {
  supplierId?: string;
  supplierName: string;
  supplierContact?: string;
  expectedDate?: string;
  status: PurchaseOrderStatus;
  paymentTerms?: string;
  notes?: string;
  items: PurchaseOrderItemInput[];
}

interface LocalApiState {
  document: StorageDocument;
  backups: LocalBackup[];
  users: LocalUser[];
  salesProfiles: SalesProfile[];
  catalogCategories: CatalogCategory[];
  catalogArticles: Omit<CatalogArticle, "categoryName">[];
  clients: Client[];
  suppliers: Supplier[];
  inventoryMovements: InventoryMovement[];
  orders: Order[];
  purchaseOrders: PurchaseOrder[];
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
      users: state.users.map((user) => stripUserSecrets(state, user))
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
    const role = readUserRole(isRecord(body) ? body.role : null);
    const salesProfile =
      role === "seller" && isRecord(body)
        ? readSalesProfileInput(body.salesProfile)
        : null;

    if (
      !isRecord(body) ||
      typeof body.username !== "string" ||
      typeof body.password !== "string" ||
      role === null ||
      username.length === 0 ||
      password.length < 8 ||
      state.users.some((user) => user.username === username) ||
      (role === "seller" &&
        (salesProfile === null ||
          !state.users.some(
            (user) =>
              user.id === salesProfile.catalogUserId && user.role === "user"
          )))
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
    if (salesProfile !== null) {
      state.salesProfiles.push(createSalesProfile(user.id, salesProfile));
    }
    await writeState(dataFilePath, state);
    sendJson(response, 201, { user: stripUserSecrets(state, user) });
    return;
  }

  const salesProfileRoute = pathname.match(/^\/api\/users\/([^/]+)\/sales-profile$/);

  if (salesProfileRoute && method === "PUT") {
    if (session.role !== "admin") {
      sendJson(response, 403, { error: "Forbidden." });
      return;
    }

    const id = decodeURIComponent(salesProfileRoute[1]);
    const body = await readJsonBody(request);
    const input = readSalesProfileInput(body);
    const seller = state.users.find((user) => user.id === id && user.role === "seller");

    if (!seller) {
      sendJson(response, 404, { error: "Not found." });
      return;
    }

    if (
      input === null ||
      !state.users.some(
        (user) => user.id === input.catalogUserId && user.role === "user"
      )
    ) {
      sendJson(response, 400, { error: "Invalid sales profile." });
      return;
    }

    const profile = upsertSalesProfile(state, id, input);

    await writeState(dataFilePath, state);
    sendJson(response, 200, { salesProfile: profile });
    return;
  }

  if (pathname === "/api/sales/dashboard" && method === "GET") {
    if (session.role !== "seller") {
      sendJson(response, 403, { error: "Forbidden." });
      return;
    }

    sendJson(response, 200, { dashboard: getSalesDashboard(state, session) });
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

  if (pathname === "/api/catalog" && method === "GET") {
    sendJson(response, 200, getCatalogForSession(state, session));
    return;
  }

  if (pathname === "/api/catalog/categories" && method === "POST") {
    if (session.role !== "user") {
      sendJson(response, 403, { error: "Forbidden." });
      return;
    }

    const input = readCategoryInput(await readJsonBody(request));

    if (input === null) {
      sendJson(response, 400, { error: "Invalid category." });
      return;
    }

    const now = new Date().toISOString();
    const category: CatalogCategory = {
      id: crypto.randomUUID(),
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
      createdAt: now,
      updatedAt: now,
      userId: session.userId
    };

    state.catalogCategories.push(category);
    await writeState(dataFilePath, state);
    sendJson(response, 201, { category });
    return;
  }

  const categoryRoute = pathname.match(/^\/api\/catalog\/categories\/([^/]+)$/);

  if (categoryRoute && method === "PUT") {
    if (session.role !== "user") {
      sendJson(response, 403, { error: "Forbidden." });
      return;
    }

    const id = decodeURIComponent(categoryRoute[1]);
    const input = readCategoryInput(await readJsonBody(request));

    if (input === null) {
      sendJson(response, 400, { error: "Invalid category." });
      return;
    }

    const categoryIndex = state.catalogCategories.findIndex(
      (category) => category.id === id && category.userId === session.userId
    );

    if (categoryIndex === -1) {
      sendJson(response, 404, { error: "Not found." });
      return;
    }

    state.catalogCategories[categoryIndex] = {
      ...state.catalogCategories[categoryIndex],
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
      ...(!input.description ? { description: undefined } : {}),
      updatedAt: new Date().toISOString()
    };
    await writeState(dataFilePath, state);
    sendJson(response, 200, { category: state.catalogCategories[categoryIndex] });
    return;
  }

  if (categoryRoute && method === "DELETE") {
    if (session.role !== "user") {
      sendJson(response, 403, { error: "Forbidden." });
      return;
    }

    const id = decodeURIComponent(categoryRoute[1]);
    const hasArticles = state.catalogArticles.some(
      (article) => article.categoryId === id && article.userId === session.userId
    );

    if (hasArticles) {
      sendJson(response, 409, { error: "Category has articles." });
      return;
    }

    state.catalogCategories = state.catalogCategories.filter(
      (category) => category.id !== id || category.userId !== session.userId
    );
    await writeState(dataFilePath, state);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (pathname === "/api/catalog/articles" && method === "POST") {
    if (session.role !== "user") {
      sendJson(response, 403, { error: "Forbidden." });
      return;
    }

    const input = readArticleInput(await readJsonBody(request));

    if (
      input === null ||
      !state.catalogCategories.some(
        (category) =>
          category.id === input.categoryId && category.userId === session.userId
      )
    ) {
      sendJson(response, 400, { error: "Invalid article." });
      return;
    }

    const now = new Date().toISOString();
    const article: Omit<CatalogArticle, "categoryName"> = {
      id: crypto.randomUUID(),
      name: input.name,
      categoryId: input.categoryId,
      ...(input.sku ? { sku: input.sku } : {}),
      ...(input.description ? { description: input.description } : {}),
      ...(input.unit ? { unit: input.unit } : {}),
      ...(typeof input.price === "number" ? { price: input.price } : {}),
      active: input.active !== false,
      createdAt: now,
      updatedAt: now,
      userId: session.userId
    };

    state.catalogArticles.push(article);
    await writeState(dataFilePath, state);
    sendJson(response, 201, {
      article: hydrateCatalogArticle(state, article)
    });
    return;
  }

  const articleRoute = pathname.match(/^\/api\/catalog\/articles\/([^/]+)$/);

  if (articleRoute && method === "PUT") {
    if (session.role !== "user") {
      sendJson(response, 403, { error: "Forbidden." });
      return;
    }

    const id = decodeURIComponent(articleRoute[1]);
    const input = readArticleInput(await readJsonBody(request));

    if (
      input === null ||
      !state.catalogCategories.some(
        (category) =>
          category.id === input.categoryId && category.userId === session.userId
      )
    ) {
      sendJson(response, 400, { error: "Invalid article." });
      return;
    }

    const articleIndex = state.catalogArticles.findIndex(
      (article) => article.id === id && article.userId === session.userId
    );

    if (articleIndex === -1) {
      sendJson(response, 404, { error: "Not found." });
      return;
    }

    state.catalogArticles[articleIndex] = {
      ...state.catalogArticles[articleIndex],
      name: input.name,
      categoryId: input.categoryId,
      sku: input.sku,
      description: input.description,
      unit: input.unit,
      price: input.price,
      active: input.active !== false,
      updatedAt: new Date().toISOString()
    };
    await writeState(dataFilePath, state);
    sendJson(response, 200, {
      article: hydrateCatalogArticle(state, state.catalogArticles[articleIndex])
    });
    return;
  }

  if (articleRoute && method === "DELETE") {
    if (session.role !== "user") {
      sendJson(response, 403, { error: "Forbidden." });
      return;
    }

    const id = decodeURIComponent(articleRoute[1]);
    state.catalogArticles = state.catalogArticles.filter(
      (article) => article.id !== id || article.userId !== session.userId
    );
    await writeState(dataFilePath, state);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (pathname === "/api/clients" && method === "GET") {
    sendJson(response, 200, {
      clients: getClientsForSession(state, session)
    });
    return;
  }

  if (pathname === "/api/clients" && method === "POST") {
    if (session.role !== "user") {
      sendJson(response, 403, { error: "Forbidden." });
      return;
    }

    const input = readClientInput(await readJsonBody(request));

    if (input === null) {
      sendJson(response, 400, { error: "Invalid client." });
      return;
    }

    if (hasClientWithName(state, session, input.name)) {
      sendJson(response, 409, { error: "Client name exists." });
      return;
    }

    const now = new Date().toISOString();
    const client: Client = {
      id: crypto.randomUUID(),
      name: input.name,
      ...(input.document ? { document: input.document } : {}),
      ...(input.email ? { email: input.email } : {}),
      ...(input.phone ? { phone: input.phone } : {}),
      ...(input.address ? { address: input.address } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      active: input.active !== false,
      createdAt: now,
      updatedAt: now,
      userId: session.userId
    };

    state.clients.push(client);
    await writeState(dataFilePath, state);
    sendJson(response, 201, { client });
    return;
  }

  const clientRoute = pathname.match(/^\/api\/clients\/([^/]+)$/);

  if (clientRoute && method === "PUT") {
    if (session.role !== "user") {
      sendJson(response, 403, { error: "Forbidden." });
      return;
    }

    const id = decodeURIComponent(clientRoute[1]);
    const input = readClientInput(await readJsonBody(request));

    if (input === null) {
      sendJson(response, 400, { error: "Invalid client." });
      return;
    }

    if (hasClientWithName(state, session, input.name, id)) {
      sendJson(response, 409, { error: "Client name exists." });
      return;
    }

    const clientIndex = state.clients.findIndex(
      (client) => client.id === id && client.userId === session.userId
    );

    if (clientIndex === -1) {
      sendJson(response, 404, { error: "Not found." });
      return;
    }

    state.clients[clientIndex] = {
      ...state.clients[clientIndex],
      name: input.name,
      document: input.document,
      email: input.email,
      phone: input.phone,
      address: input.address,
      notes: input.notes,
      active: input.active !== false,
      updatedAt: new Date().toISOString()
    };
    await writeState(dataFilePath, state);
    sendJson(response, 200, { client: state.clients[clientIndex] });
    return;
  }

  if (clientRoute && method === "DELETE") {
    if (session.role !== "user") {
      sendJson(response, 403, { error: "Forbidden." });
      return;
    }

    const id = decodeURIComponent(clientRoute[1]);
    const hasOrders = state.orders.some(
      (order) => order.customerId === id && order.userId === session.userId
    );

    if (hasOrders) {
      sendJson(response, 409, { error: "Client has orders." });
      return;
    }

    state.clients = state.clients.filter(
      (client) => client.id !== id || client.userId !== session.userId
    );
    await writeState(dataFilePath, state);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (pathname === "/api/suppliers" && method === "GET") {
    sendJson(response, 200, {
      suppliers: getSuppliersForSession(state, session)
    });
    return;
  }

  if (pathname === "/api/suppliers" && method === "POST") {
    if (session.role !== "user") {
      sendJson(response, 403, { error: "Forbidden." });
      return;
    }

    const input = readSupplierInput(await readJsonBody(request));

    if (input === null) {
      sendJson(response, 400, { error: "Invalid supplier." });
      return;
    }

    if (hasSupplierWithName(state, session, input.name)) {
      sendJson(response, 409, { error: "Supplier name exists." });
      return;
    }

    const now = new Date().toISOString();
    const supplier: Supplier = {
      id: crypto.randomUUID(),
      name: input.name,
      ...(input.taxId ? { taxId: input.taxId } : {}),
      ...(input.contactName ? { contactName: input.contactName } : {}),
      ...(input.email ? { email: input.email } : {}),
      ...(input.phone ? { phone: input.phone } : {}),
      ...(input.address ? { address: input.address } : {}),
      ...(input.city ? { city: input.city } : {}),
      ...(input.province ? { province: input.province } : {}),
      ...(input.country ? { country: input.country } : {}),
      ...(input.paymentTerms ? { paymentTerms: input.paymentTerms } : {}),
      ...(input.bankAccount ? { bankAccount: input.bankAccount } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      active: input.active !== false,
      createdAt: now,
      updatedAt: now,
      userId: session.userId
    };

    state.suppliers.push(supplier);
    await writeState(dataFilePath, state);
    sendJson(response, 201, { supplier });
    return;
  }

  const supplierRoute = pathname.match(/^\/api\/suppliers\/([^/]+)$/);

  if (supplierRoute && method === "PUT") {
    if (session.role !== "user") {
      sendJson(response, 403, { error: "Forbidden." });
      return;
    }

    const id = decodeURIComponent(supplierRoute[1]);
    const input = readSupplierInput(await readJsonBody(request));

    if (input === null) {
      sendJson(response, 400, { error: "Invalid supplier." });
      return;
    }

    if (hasSupplierWithName(state, session, input.name, id)) {
      sendJson(response, 409, { error: "Supplier name exists." });
      return;
    }

    const supplierIndex = state.suppliers.findIndex(
      (supplier) => supplier.id === id && supplier.userId === session.userId
    );

    if (supplierIndex === -1) {
      sendJson(response, 404, { error: "Not found." });
      return;
    }

    state.suppliers[supplierIndex] = {
      ...state.suppliers[supplierIndex],
      name: input.name,
      taxId: input.taxId,
      contactName: input.contactName,
      email: input.email,
      phone: input.phone,
      address: input.address,
      city: input.city,
      province: input.province,
      country: input.country,
      paymentTerms: input.paymentTerms,
      bankAccount: input.bankAccount,
      category: input.category,
      notes: input.notes,
      active: input.active !== false,
      updatedAt: new Date().toISOString()
    };
    await writeState(dataFilePath, state);
    sendJson(response, 200, { supplier: state.suppliers[supplierIndex] });
    return;
  }

  if (supplierRoute && method === "DELETE") {
    if (session.role !== "user") {
      sendJson(response, 403, { error: "Forbidden." });
      return;
    }

    const id = decodeURIComponent(supplierRoute[1]);
    const hasPurchaseOrders = state.purchaseOrders.some(
      (order) => order.supplierId === id && order.userId === session.userId
    );

    if (hasPurchaseOrders) {
      sendJson(response, 409, { error: "Supplier has purchase orders." });
      return;
    }

    state.suppliers = state.suppliers.filter(
      (supplier) => supplier.id !== id || supplier.userId !== session.userId
    );
    await writeState(dataFilePath, state);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (pathname === "/api/inventory" && method === "GET") {
    sendJson(response, 200, getInventoryForSession(state, session));
    return;
  }

  if (pathname === "/api/inventory/movements" && method === "POST") {
    if (session.role !== "user") {
      sendJson(response, 403, { error: "Forbidden." });
      return;
    }

    const input = readInventoryMovementInput(await readJsonBody(request));

    if (
      input === null ||
      !state.catalogArticles.some(
        (article) => article.id === input.articleId && article.userId === session.userId
      )
    ) {
      sendJson(response, 400, { error: "Invalid inventory movement." });
      return;
    }

    const movement: InventoryMovement = {
      id: crypto.randomUUID(),
      articleId: input.articleId,
      type: input.type,
      quantity: input.quantity,
      reason: input.reason,
      ...(input.notes ? { notes: input.notes } : {}),
      createdAt: new Date().toISOString(),
      userId: session.userId
    };

    state.inventoryMovements.push(movement);
    await writeState(dataFilePath, state);
    sendJson(response, 201, {
      movement: hydrateInventoryMovement(state, movement)
    });
    return;
  }

  if (pathname === "/api/orders" && method === "GET") {
    sendJson(response, 200, {
      orders: getOrdersForSession(state, session)
    });
    return;
  }

  if (pathname === "/api/orders" && method === "POST") {
    if (session.role !== "user" && session.role !== "seller") {
      sendJson(response, 403, { error: "Forbidden." });
      return;
    }

    const input = readOrderInput(await readJsonBody(request));

    if (input === null) {
      sendJson(response, 400, { error: "Invalid order." });
      return;
    }

    const orderResult = createLocalOrder(state, input, session);

    if (!orderResult.ok) {
      sendJson(response, 400, { error: orderResult.error });
      return;
    }

    state.orders.push(orderResult.order);
    state.document.transactions.push(orderResult.transaction);
    state.inventoryMovements.push(...orderResult.movements);
    state.document.lastUpdatedAt = new Date().toISOString();
    await writeState(dataFilePath, state);
    sendJson(response, 201, { order: orderResult.order });
    return;
  }

  const orderStatusRoute = pathname.match(/^\/api\/orders\/([^/]+)\/status$/);

  if (orderStatusRoute && method === "PUT") {
    if (session.role !== "user" && session.role !== "seller") {
      sendJson(response, 403, { error: "Forbidden." });
      return;
    }

    const id = decodeURIComponent(orderStatusRoute[1]);
    const status = readOrderStatusInput(await readJsonBody(request));

    if (status === null) {
      sendJson(response, 400, { error: "Invalid order status." });
      return;
    }

    const orderIndex = state.orders.findIndex(
      (order) => order.id === id && order.userId === session.userId
    );

    if (orderIndex === -1) {
      sendJson(response, 404, { error: "Not found." });
      return;
    }

    state.orders[orderIndex] = {
      ...state.orders[orderIndex],
      status,
      updatedAt: new Date().toISOString()
    };
    await writeState(dataFilePath, state);
    sendJson(response, 200, { order: state.orders[orderIndex] });
    return;
  }

  if (pathname === "/api/purchase-orders" && method === "GET") {
    sendJson(response, 200, getPurchaseOrdersForSession(state, session));
    return;
  }

  if (pathname === "/api/purchase-orders" && method === "POST") {
    if (session.role !== "user") {
      sendJson(response, 403, { error: "Forbidden." });
      return;
    }

    const input = readPurchaseOrderInput(await readJsonBody(request));

    if (
      input === null ||
      !state.suppliers.some(
        (supplier) =>
          supplier.id === input.supplierId &&
          supplier.userId === session.userId &&
          supplier.active
      ) ||
      input.items.some(
        (item) =>
          !state.catalogArticles.some(
            (article) => article.id === item.articleId && article.userId === session.userId
          )
      )
    ) {
      sendJson(response, 400, { error: "Invalid purchase order." });
      return;
    }

    const now = new Date().toISOString();
    const order: PurchaseOrder = {
      id: crypto.randomUUID(),
      orderNumber: createLocalPurchaseOrderNumber(state, session),
      ...(input.supplierId ? { supplierId: input.supplierId } : {}),
      supplierName: input.supplierName,
      ...(input.supplierContact ? { supplierContact: input.supplierContact } : {}),
      ...(input.expectedDate ? { expectedDate: input.expectedDate } : {}),
      status: input.status,
      ...(input.paymentTerms ? { paymentTerms: input.paymentTerms } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      items: input.items.map((item) => ({
        id: crypto.randomUUID(),
        articleId: item.articleId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        ...(item.notes ? { notes: item.notes } : {})
      })),
      createdAt: now,
      updatedAt: now,
      ...(input.status === "received" ? { receivedAt: now, inventoryPostedAt: now } : {}),
      userId: session.userId
    };

    state.purchaseOrders.push(order);
    if (input.status === "received") {
      postLocalPurchaseOrderEffects(state, order, session, now);
    }

    await writeState(dataFilePath, state);
    sendJson(response, 201, {
      order: hydratePurchaseOrder(state, order)
    });
    return;
  }

  const purchaseOrderStatusRoute = pathname.match(
    /^\/api\/purchase-orders\/([^/]+)\/status$/
  );

  if (purchaseOrderStatusRoute && method === "PATCH") {
    if (session.role !== "user") {
      sendJson(response, 403, { error: "Forbidden." });
      return;
    }

    const id = decodeURIComponent(purchaseOrderStatusRoute[1]);
    const body = await readJsonBody(request);
    const status = isRecord(body) ? readPurchaseOrderStatus(body.status) : null;
    const order = state.purchaseOrders.find(
      (current) => current.id === id && current.userId === session.userId
    );

    if (!order || status === null || status === "draft") {
      sendJson(response, order ? 400 : 404, {
        error: order ? "Invalid purchase order status." : "Not found."
      });
      return;
    }

    if (order.status === "cancelled" || order.status === "received") {
      sendJson(response, 409, { error: "Status is closed." });
      return;
    }

    const now = new Date().toISOString();
    order.status = status;
    order.updatedAt = now;
    if (status === "received") {
      order.receivedAt = now;
      if (!order.inventoryPostedAt) {
        order.inventoryPostedAt = now;
        postLocalPurchaseOrderEffects(state, order, session, now);
      }
    }

    await writeState(dataFilePath, state);
    sendJson(response, 200, {
      order: hydratePurchaseOrder(state, order)
    });
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
      return ensureLocalPurchaseOrderTransactions({
        ...parsed,
        users: parsed.users ?? [],
        salesProfiles: parsed.salesProfiles ?? [],
        catalogCategories: parsed.catalogCategories ?? [],
        catalogArticles: parsed.catalogArticles ?? [],
        clients: parsed.clients ?? [],
        suppliers: parsed.suppliers ?? [],
        inventoryMovements: parsed.inventoryMovements ?? [],
        orders: parsed.orders ?? [],
        purchaseOrders: parsed.purchaseOrders ?? [],
        document: {
          ...parsed.document,
          transactions: parsed.document.transactions
        }
      });
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
    users: [],
    salesProfiles: [],
    catalogCategories: [],
    catalogArticles: [],
    clients: [],
    suppliers: [],
    inventoryMovements: [],
    orders: [],
    purchaseOrders: []
  };
}

function ensureLocalPurchaseOrderTransactions(state: LocalApiState) {
  let changed = false;

  for (const order of state.purchaseOrders) {
    if (
      order.status !== "received" ||
      state.document.transactions.some(
        (transaction) => transaction.notes?.includes(order.id)
      )
    ) {
      continue;
    }

    const createdAt = order.receivedAt ?? order.updatedAt ?? order.createdAt;
    const totalAmount = order.items.reduce(
      (total, item) => total + item.quantity * item.unitCost,
      0
    );

    if (totalAmount <= 0) {
      continue;
    }

    state.document.transactions.push({
      id: `purchase-${order.id}`,
      userId: order.userId,
      type: "expense",
      date: createdAt.slice(0, 10),
      amount: roundMoney(totalAmount),
      category: "other_expense",
      description: `Orden de compra ${order.orderNumber} - ${order.supplierName}`,
      paymentMethod: "bank_transfer",
      notes: order.paymentTerms
        ? `Condiciones: ${order.paymentTerms}. Orden de compra ${order.orderNumber} (${order.id})`
        : `Orden de compra ${order.orderNumber} (${order.id})`,
      createdAt,
      updatedAt: createdAt
    });
    changed = true;
  }

  if (changed) {
    state.document.lastUpdatedAt = new Date().toISOString();
  }

  return state;
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
      (session.role !== "admin" &&
        session.role !== "user" &&
        session.role !== "seller") ||
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

function getCatalogForSession(state: LocalApiState, session: AuthSession) {
  const catalogUserId = resolveCatalogUserId(state, session);
  const categories = state.catalogCategories
    .filter(
      (category) =>
        session.role === "admin" || category.userId === catalogUserId
    )
    .sort((left, right) => left.name.localeCompare(right.name));
  const categoryIds = new Set(categories.map((category) => category.id));
  const articles = state.catalogArticles
    .filter(
      (article) =>
        categoryIds.has(article.categoryId) &&
        (session.role === "admin" || article.userId === catalogUserId)
    )
    .map((article) => hydrateCatalogArticle(state, article))
    .sort((left, right) => left.name.localeCompare(right.name));

  return { categories, articles };
}

function hydrateCatalogArticle(
  state: LocalApiState,
  article: Omit<CatalogArticle, "categoryName">
): CatalogArticle {
  const category = state.catalogCategories.find(
    (current) => current.id === article.categoryId
  );

  return {
    ...article,
    categoryName: category?.name ?? "Sin categoria"
  };
}

function getInventoryForSession(state: LocalApiState, session: AuthSession) {
  const catalog = getCatalogForSession(state, session);
  const articleIds = new Set(catalog.articles.map((article) => article.id));
  const quantityMovements = state.inventoryMovements.filter((movement) =>
    articleIds.has(movement.articleId)
  );
  const visibleMovements = quantityMovements.filter(
    (movement) => session.role === "admin" || movement.userId === session.userId
  );
  const quantities = quantityMovements.reduce<Record<string, number>>(
    (current, movement) => {
      const signedQuantity =
        movement.type === "in"
          ? movement.quantity
          : movement.type === "out"
            ? -movement.quantity
            : movement.quantity;

      current[movement.articleId] =
        (current[movement.articleId] ?? 0) + signedQuantity;
      return current;
    },
    {}
  );

  return {
    items: catalog.articles.map((article) => ({
      articleId: article.id,
      articleName: article.name,
      categoryName: article.categoryName,
      ...(article.sku ? { sku: article.sku } : {}),
      ...(article.unit ? { unit: article.unit } : {}),
      ...(typeof article.price === "number" ? { price: article.price } : {}),
      active: article.active,
      quantity: quantities[article.id] ?? 0
    })),
    movements: visibleMovements
      .map((movement) => hydrateInventoryMovement(state, movement))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 100)
  };
}

function hydrateInventoryMovement(
  state: LocalApiState,
  movement: InventoryMovement
) {
  const article = state.catalogArticles.find(
    (current) => current.id === movement.articleId
  );
  const category = article
    ? state.catalogCategories.find((current) => current.id === article.categoryId)
    : null;

  return {
    id: movement.id,
    articleId: movement.articleId,
    articleName: article?.name ?? "Producto eliminado",
    categoryName: category?.name ?? "Sin categoria",
    type: movement.type,
    quantity: movement.quantity,
    reason: movement.reason,
    ...(movement.notes ? { notes: movement.notes } : {}),
    createdAt: movement.createdAt,
    ...(movement.userId ? { userId: movement.userId } : {})
  };
}

function getClientsForSession(state: LocalApiState, session: AuthSession) {
  const catalogUserId = resolveCatalogUserId(state, session);

  return state.clients
    .filter((client) => session.role === "admin" || client.userId === catalogUserId)
    .sort((left, right) => {
      if (left.active !== right.active) {
        return left.active ? -1 : 1;
      }

      return left.name.localeCompare(right.name, "es", { sensitivity: "base" });
    });
}

function hasClientWithName(
  state: LocalApiState,
  session: AuthSession,
  name: string,
  exceptId?: string
) {
  return state.clients.some(
    (client) =>
      client.userId === session.userId &&
      client.id !== exceptId &&
      client.name.localeCompare(name, "es", { sensitivity: "base" }) === 0
  );
}

function getSuppliersForSession(state: LocalApiState, session: AuthSession) {
  return state.suppliers
    .filter((supplier) => session.role === "admin" || supplier.userId === session.userId)
    .sort((left, right) => {
      if (left.active !== right.active) {
        return left.active ? -1 : 1;
      }

      return left.name.localeCompare(right.name, "es", { sensitivity: "base" });
    });
}

function hasSupplierWithName(
  state: LocalApiState,
  session: AuthSession,
  name: string,
  exceptId?: string
) {
  return state.suppliers.some(
    (supplier) =>
      supplier.userId === session.userId &&
      supplier.id !== exceptId &&
      supplier.name.localeCompare(name, "es", { sensitivity: "base" }) === 0
  );
}

function getOrdersForSession(state: LocalApiState, session: AuthSession) {
  return state.orders
    .filter((order) => session.role === "admin" || order.userId === session.userId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function createLocalOrder(
  state: LocalApiState,
  input: OrderInput,
  session: AuthSession
):
  | {
      ok: true;
      order: Order;
      transaction: FinancialTransaction;
      movements: InventoryMovement[];
    }
  | { ok: false; error: string } {
  const catalog = getCatalogForSession(state, session);
  const inventory = getInventoryForSession(state, session);
  const articlesById = new Map(catalog.articles.map((article) => [article.id, article]));
  const stockByArticleId = new Map(
    inventory.items.map((item) => [item.articleId, item.quantity])
  );
  const client = state.clients.find(
    (candidate) =>
      candidate.id === input.customerId &&
      candidate.userId === resolveCatalogUserId(state, session) &&
      candidate.active
  );
  const requestedItems = mergeOrderItems(input.items);
  const now = new Date().toISOString();
  const orderId = crypto.randomUUID();
  const transactionId = crypto.randomUUID();
  const orderNumber = createOrderNumber(now);
  const orderItems: OrderItem[] = [];

  if (!client) {
    return { ok: false, error: "Invalid client." };
  }

  for (const item of requestedItems) {
    const article = articlesById.get(item.articleId);

    if (!article || !article.active) {
      return { ok: false, error: "Invalid article." };
    }

    if (typeof article.price !== "number" || article.price <= 0) {
      return { ok: false, error: "Missing price." };
    }

    if ((stockByArticleId.get(item.articleId) ?? 0) < item.quantity) {
      return { ok: false, error: "Insufficient stock." };
    }

    orderItems.push({
      id: crypto.randomUUID(),
      orderId,
      articleId: item.articleId,
      articleName: article.name,
      quantity: item.quantity,
      unitPrice: article.price,
      lineTotal: roundMoney(article.price * item.quantity)
    });
  }

  const totalAmount = roundMoney(
    orderItems.reduce((total, item) => total + item.lineTotal, 0)
  );

  if (totalAmount <= 0) {
    return { ok: false, error: "Invalid order." };
  }

  const order: Order = {
    id: orderId,
    orderNumber,
    customerId: client.id,
    customerName: client.name,
    status: input.status,
    paymentMethod: input.paymentMethod,
    totalAmount,
    ...(input.notes ? { notes: input.notes } : {}),
    transactionId,
    createdAt: now,
    updatedAt: now,
    userId: session.userId,
    items: orderItems
  };
  const transaction: FinancialTransaction = {
    id: transactionId,
    userId: session.userId,
    type: "income",
    date: now.slice(0, 10),
    amount: totalAmount,
    category: "sale",
    description: `Pedido ${orderNumber} - ${client.name}`,
    paymentMethod: input.paymentMethod,
    ...(input.notes ? { notes: input.notes } : {}),
    createdAt: now,
    updatedAt: now
  };
  const movements = orderItems.map<InventoryMovement>((item) => ({
    id: crypto.randomUUID(),
    articleId: item.articleId,
    type: "out",
    quantity: item.quantity,
    reason: `Pedido ${orderNumber}`,
    notes: client.name,
    createdAt: now,
    userId: session.userId
  }));

  return { ok: true, order, transaction, movements };
}

function getPurchaseOrdersForSession(
  state: LocalApiState,
  session: AuthSession
) {
  return {
    orders: state.purchaseOrders
      .filter((order) => session.role === "admin" || order.userId === session.userId)
      .map((order) => hydratePurchaseOrder(state, order))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  };
}

function hydratePurchaseOrder(state: LocalApiState, order: PurchaseOrder) {
  const items = order.items.map((item) => {
    const article = state.catalogArticles.find(
      (current) => current.id === item.articleId
    );
    const category = article
      ? state.catalogCategories.find((current) => current.id === article.categoryId)
      : null;

    return {
      id: item.id,
      articleId: item.articleId,
      articleName: article?.name ?? "Producto eliminado",
      categoryName: category?.name ?? "Sin categoria",
      quantity: item.quantity,
      unitCost: item.unitCost,
      lineTotal: item.quantity * item.unitCost,
      ...(item.notes ? { notes: item.notes } : {})
    };
  });

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    ...(order.supplierId ? { supplierId: order.supplierId } : {}),
    supplierName: order.supplierName,
    ...(order.supplierContact ? { supplierContact: order.supplierContact } : {}),
    ...(order.expectedDate ? { expectedDate: order.expectedDate } : {}),
    status: order.status,
    ...(order.paymentTerms ? { paymentTerms: order.paymentTerms } : {}),
    ...(order.notes ? { notes: order.notes } : {}),
    items,
    totalAmount: items.reduce((total, item) => total + item.lineTotal, 0),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    ...(order.receivedAt ? { receivedAt: order.receivedAt } : {}),
    ...(order.inventoryPostedAt
      ? { inventoryPostedAt: order.inventoryPostedAt }
      : {}),
    ...(order.userId ? { userId: order.userId } : {})
  };
}

function postLocalPurchaseOrderEffects(
  state: LocalApiState,
  order: PurchaseOrder,
  session: AuthSession,
  createdAt: string
) {
  const totalAmount = order.items.reduce(
    (total, item) => total + item.quantity * item.unitCost,
    0
  );

  state.document.transactions.push({
    id: crypto.randomUUID(),
    userId: session.userId,
    type: "expense",
    date: createdAt.slice(0, 10),
    amount: roundMoney(totalAmount),
    category: "other_expense",
    description: `Orden de compra ${order.orderNumber} - ${order.supplierName}`,
    paymentMethod: "bank_transfer",
    notes: order.paymentTerms
      ? `Condiciones: ${order.paymentTerms}. Orden de compra ${order.orderNumber} (${order.id})`
      : `Orden de compra ${order.orderNumber} (${order.id})`,
    createdAt,
    updatedAt: createdAt
  });
  state.document.lastUpdatedAt = createdAt;

  for (const item of order.items) {
    state.inventoryMovements.push({
      id: crypto.randomUUID(),
      articleId: item.articleId,
      type: "in",
      quantity: item.quantity,
      reason: `Recepcion ${order.orderNumber}`,
      notes: `Orden de compra ${order.orderNumber} (${order.id})`,
      createdAt,
      userId: session.userId
    });
  }
}

function createLocalPurchaseOrderNumber(
  state: LocalApiState,
  session: AuthSession
) {
  const count = state.purchaseOrders.filter(
    (order) => order.userId === session.userId
  ).length;

  return `OC-${String(count + 1).padStart(5, "0")}`;
}

function resolveCatalogUserId(state: LocalApiState, session: AuthSession) {
  if (session.role !== "seller") {
    return session.userId;
  }

  return (
    state.salesProfiles.find((profile) => profile.userId === session.userId)
      ?.catalogUserId ?? session.userId
  );
}

function readUserRole(value: unknown): UserRole | null {
  if (value === "admin" || value === "user" || value === "seller") {
    return value;
  }

  return null;
}

function readSalesProfileInput(value: unknown): SalesProfileInput | null {
  if (
    !isRecord(value) ||
    typeof value.catalogUserId !== "string" ||
    typeof value.commissionRate !== "number" ||
    typeof value.bonusGoalAmount !== "number" ||
    typeof value.bonusAmount !== "number" ||
    value.catalogUserId.trim().length === 0 ||
    !Number.isFinite(value.commissionRate) ||
    value.commissionRate < 0 ||
    value.commissionRate > 100 ||
    !Number.isFinite(value.bonusGoalAmount) ||
    value.bonusGoalAmount < 0 ||
    !Number.isFinite(value.bonusAmount) ||
    value.bonusAmount < 0
  ) {
    return null;
  }

  return {
    catalogUserId: value.catalogUserId.trim(),
    commissionRate: roundMoney(value.commissionRate),
    bonusGoalAmount: roundMoney(value.bonusGoalAmount),
    bonusAmount: roundMoney(value.bonusAmount)
  };
}

function createSalesProfile(userId: string, input: SalesProfileInput): SalesProfile {
  const now = new Date().toISOString();

  return {
    userId,
    catalogUserId: input.catalogUserId,
    commissionRate: input.commissionRate,
    bonusGoalAmount: input.bonusGoalAmount,
    bonusAmount: input.bonusAmount,
    createdAt: now,
    updatedAt: now
  };
}

function upsertSalesProfile(
  state: LocalApiState,
  userId: string,
  input: SalesProfileInput
) {
  const currentIndex = state.salesProfiles.findIndex(
    (profile) => profile.userId === userId
  );

  if (currentIndex === -1) {
    const profile = createSalesProfile(userId, input);

    state.salesProfiles.push(profile);
    return profile;
  }

  const current = state.salesProfiles[currentIndex];
  const profile: SalesProfile = {
    ...current,
    catalogUserId: input.catalogUserId,
    commissionRate: input.commissionRate,
    bonusGoalAmount: input.bonusGoalAmount,
    bonusAmount: input.bonusAmount,
    updatedAt: new Date().toISOString()
  };

  state.salesProfiles[currentIndex] = profile;
  return profile;
}

function getSalesDashboard(state: LocalApiState, session: AuthSession) {
  const profile =
    state.salesProfiles.find((current) => current.userId === session.userId) ??
    createSalesProfile(session.userId, {
      catalogUserId: session.userId,
      commissionRate: 0,
      bonusGoalAmount: 0,
      bonusAmount: 0
    });
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  )
    .toISOString()
    .slice(0, 10);
  const nextMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  )
    .toISOString()
    .slice(0, 10);
  const month = summarizeSales(state, session.userId, monthStart, nextMonthStart);
  const allTime = summarizeSales(state, session.userId);
  const commissionAmount = roundMoney(
    month.totalAmount * (profile.commissionRate / 100)
  );
  const bonusAmount =
    profile.bonusGoalAmount > 0 && month.totalAmount >= profile.bonusGoalAmount
      ? profile.bonusAmount
      : 0;

  return {
    seller: {
      id: session.userId,
      username: session.username
    },
    profile,
    month: {
      startsAt: monthStart,
      totalAmount: month.totalAmount,
      orderCount: month.orderCount,
      averageOrderAmount:
        month.orderCount > 0 ? roundMoney(month.totalAmount / month.orderCount) : 0,
      commissionAmount,
      bonusAmount,
      estimatedPayout: roundMoney(commissionAmount + bonusAmount),
      goalProgress:
        profile.bonusGoalAmount > 0
          ? Math.min(
              100,
              roundMoney((month.totalAmount / profile.bonusGoalAmount) * 100)
            )
          : 0
    },
    allTime
  };
}

function summarizeSales(
  state: LocalApiState,
  userId: string,
  startDate?: string,
  endDate?: string
) {
  const orders = state.orders.filter(
    (order) =>
      order.userId === userId &&
      order.status !== "cancelled" &&
      (!startDate || order.createdAt.slice(0, 10) >= startDate) &&
      (!endDate || order.createdAt.slice(0, 10) < endDate)
  );

  return {
    totalAmount: roundMoney(
      orders.reduce((total, order) => total + order.totalAmount, 0)
    ),
    orderCount: orders.length
  };
}

function stripUserSecrets(state: LocalApiState, user: LocalUser) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt,
    salesProfile:
      state.salesProfiles.find((profile) => profile.userId === user.id) ?? null
  };
}

function readCategoryInput(
  value: unknown
): Pick<CatalogCategory, "name" | "description"> | null {
  if (!isRecord(value) || typeof value.name !== "string") {
    return null;
  }

  const name = value.name.trim();

  if (name.length === 0) {
    return null;
  }

  return {
    name,
    ...(typeof value.description === "string" && value.description.trim()
      ? { description: value.description.trim() }
      : {})
  };
}

function readArticleInput(value: unknown): CatalogArticleInput | null {
  if (
    !isRecord(value) ||
    typeof value.name !== "string" ||
    typeof value.categoryId !== "string"
  ) {
    return null;
  }

  const name = value.name.trim();
  const categoryId = value.categoryId.trim();

  if (
    name.length === 0 ||
    categoryId.length === 0 ||
    (value.price !== undefined &&
      (typeof value.price !== "number" || value.price < 0))
  ) {
    return null;
  }

  return {
    name,
    categoryId,
    ...(typeof value.sku === "string" && value.sku.trim()
      ? { sku: value.sku.trim() }
      : {}),
    ...(typeof value.description === "string" && value.description.trim()
      ? { description: value.description.trim() }
      : {}),
    ...(typeof value.unit === "string" && value.unit.trim()
      ? { unit: value.unit.trim() }
      : {}),
    ...(typeof value.price === "number" ? { price: value.price } : {}),
    ...(typeof value.active === "boolean" ? { active: value.active } : {})
  };
}

function readClientInput(value: unknown): ClientInput | null {
  if (!isRecord(value) || typeof value.name !== "string") {
    return null;
  }

  const name = value.name.trim();

  if (name.length === 0) {
    return null;
  }

  return {
    name,
    ...(typeof value.document === "string" && value.document.trim()
      ? { document: value.document.trim() }
      : {}),
    ...(typeof value.email === "string" && value.email.trim()
      ? { email: value.email.trim() }
      : {}),
    ...(typeof value.phone === "string" && value.phone.trim()
      ? { phone: value.phone.trim() }
      : {}),
    ...(typeof value.address === "string" && value.address.trim()
      ? { address: value.address.trim() }
      : {}),
    ...(typeof value.notes === "string" && value.notes.trim()
      ? { notes: value.notes.trim() }
      : {}),
    ...(typeof value.active === "boolean" ? { active: value.active } : {})
  };
}

function readSupplierInput(value: unknown): SupplierInput | null {
  if (!isRecord(value) || typeof value.name !== "string") {
    return null;
  }

  const name = value.name.trim();

  if (name.length === 0) {
    return null;
  }

  return {
    name,
    ...(typeof value.taxId === "string" && value.taxId.trim()
      ? { taxId: value.taxId.trim() }
      : {}),
    ...(typeof value.contactName === "string" && value.contactName.trim()
      ? { contactName: value.contactName.trim() }
      : {}),
    ...(typeof value.email === "string" && value.email.trim()
      ? { email: value.email.trim() }
      : {}),
    ...(typeof value.phone === "string" && value.phone.trim()
      ? { phone: value.phone.trim() }
      : {}),
    ...(typeof value.address === "string" && value.address.trim()
      ? { address: value.address.trim() }
      : {}),
    ...(typeof value.city === "string" && value.city.trim()
      ? { city: value.city.trim() }
      : {}),
    ...(typeof value.province === "string" && value.province.trim()
      ? { province: value.province.trim() }
      : {}),
    ...(typeof value.country === "string" && value.country.trim()
      ? { country: value.country.trim() }
      : {}),
    ...(typeof value.paymentTerms === "string" && value.paymentTerms.trim()
      ? { paymentTerms: value.paymentTerms.trim() }
      : {}),
    ...(typeof value.bankAccount === "string" && value.bankAccount.trim()
      ? { bankAccount: value.bankAccount.trim() }
      : {}),
    ...(typeof value.category === "string" && value.category.trim()
      ? { category: value.category.trim() }
      : {}),
    ...(typeof value.notes === "string" && value.notes.trim()
      ? { notes: value.notes.trim() }
      : {}),
    ...(typeof value.active === "boolean" ? { active: value.active } : {})
  };
}

function readInventoryMovementInput(
  value: unknown
): InventoryMovementInput | null {
  if (
    !isRecord(value) ||
    typeof value.articleId !== "string" ||
    !isInventoryMovementType(value.type) ||
    typeof value.quantity !== "number" ||
    typeof value.reason !== "string"
  ) {
    return null;
  }

  const articleId = value.articleId.trim();
  const reason = value.reason.trim();

  if (
    articleId.length === 0 ||
    reason.length === 0 ||
    !Number.isFinite(value.quantity) ||
    value.quantity === 0 ||
    (value.type !== "adjustment" && value.quantity <= 0)
  ) {
    return null;
  }

  return {
    articleId,
    type: value.type,
    quantity: value.quantity,
    reason,
    ...(typeof value.notes === "string" && value.notes.trim()
      ? { notes: value.notes.trim() }
      : {})
  };
}

function readOrderInput(value: unknown): OrderInput | null {
  if (
    !isRecord(value) ||
    typeof value.customerId !== "string" ||
    typeof value.paymentMethod !== "string" ||
    !isOrderStatus(value.status) ||
    !Array.isArray(value.items)
  ) {
    return null;
  }

  const customerId = value.customerId.trim();
  const paymentMethod = value.paymentMethod.trim();
  const items = value.items.map(readOrderItemInput);

  if (
    customerId.length === 0 ||
    paymentMethod.length === 0 ||
    !isPaymentMethod(paymentMethod) ||
    items.length === 0 ||
    items.some((item) => item === null)
  ) {
    return null;
  }

  return {
    customerId,
    status: value.status,
    paymentMethod,
    items: items as OrderInput["items"],
    ...(typeof value.notes === "string" && value.notes.trim()
      ? { notes: value.notes.trim() }
      : {})
  };
}

function readOrderStatusInput(value: unknown): OrderStatus | null {
  if (!isRecord(value)) {
    return null;
  }

  return isOrderStatus(value.status) ? value.status : null;
}

function readOrderItemInput(value: unknown) {
  if (
    !isRecord(value) ||
    typeof value.articleId !== "string" ||
    typeof value.quantity !== "number"
  ) {
    return null;
  }

  const articleId = value.articleId.trim();

  if (
    articleId.length === 0 ||
    !Number.isFinite(value.quantity) ||
    value.quantity <= 0
  ) {
    return null;
  }

  return {
    articleId,
    quantity: value.quantity
  };
}

function mergeOrderItems(items: OrderInput["items"]) {
  const quantitiesByArticle = items.reduce<Record<string, number>>(
    (quantities, item) => {
      quantities[item.articleId] = (quantities[item.articleId] ?? 0) + item.quantity;
      return quantities;
    },
    {}
  );

  return Object.entries(quantitiesByArticle).map(([articleId, quantity]) => ({
    articleId,
    quantity
  }));
}

function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    value === "pending" ||
    value === "confirmed" ||
    value === "delivered" ||
    value === "cancelled"
  );
}

function isPaymentMethod(value: string) {
  return (
    value === "cash" ||
    value === "debit_card" ||
    value === "credit_card" ||
    value === "bank_transfer" ||
    value === "digital_wallet" ||
    value === "other"
  );
}

function isInventoryMovementType(value: unknown): value is InventoryMovementType {
  return value === "in" || value === "out" || value === "adjustment";
}

function readPurchaseOrderInput(value: unknown): PurchaseOrderInput | null {
  if (
    !isRecord(value) ||
    typeof value.supplierId !== "string" ||
    typeof value.supplierName !== "string"
  ) {
    return null;
  }

  const supplierId = value.supplierId.trim();
  const supplierName = value.supplierName.trim();
  const status = readPurchaseOrderStatus(value.status);
  const items = Array.isArray(value.items)
    ? value.items.map(readPurchaseOrderItemInput)
    : [];

  if (
    supplierId.length === 0 ||
    supplierName.length === 0 ||
    status === null ||
    status === "cancelled" ||
    items.length === 0 ||
    items.some((item) => item === null)
  ) {
    return null;
  }

  return {
    supplierId,
    supplierName,
    status,
    ...(typeof value.supplierContact === "string" && value.supplierContact.trim()
      ? { supplierContact: value.supplierContact.trim() }
      : {}),
    ...(typeof value.expectedDate === "string" && value.expectedDate.trim()
      ? { expectedDate: value.expectedDate.trim() }
      : {}),
    ...(typeof value.paymentTerms === "string" && value.paymentTerms.trim()
      ? { paymentTerms: value.paymentTerms.trim() }
      : {}),
    ...(typeof value.notes === "string" && value.notes.trim()
      ? { notes: value.notes.trim() }
      : {}),
    items: items as PurchaseOrderItemInput[]
  };
}

function readPurchaseOrderItemInput(
  value: unknown
): PurchaseOrderItemInput | null {
  if (
    !isRecord(value) ||
    typeof value.articleId !== "string" ||
    typeof value.quantity !== "number" ||
    typeof value.unitCost !== "number"
  ) {
    return null;
  }

  const articleId = value.articleId.trim();

  if (
    articleId.length === 0 ||
    !Number.isFinite(value.quantity) ||
    !Number.isFinite(value.unitCost) ||
    value.quantity <= 0 ||
    value.unitCost < 0
  ) {
    return null;
  }

  return {
    articleId,
    quantity: value.quantity,
    unitCost: value.unitCost,
    ...(typeof value.notes === "string" && value.notes.trim()
      ? { notes: value.notes.trim() }
      : {})
  };
}

function readPurchaseOrderStatus(
  value: unknown
): PurchaseOrderStatus | null {
  return value === "draft" ||
    value === "sent" ||
    value === "received" ||
    value === "cancelled"
    ? value
    : null;
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
    (!("users" in value) || Array.isArray(value.users)) &&
    (!("salesProfiles" in value) || Array.isArray(value.salesProfiles)) &&
    (!("catalogCategories" in value) ||
      Array.isArray(value.catalogCategories)) &&
    (!("catalogArticles" in value) || Array.isArray(value.catalogArticles)) &&
    (!("clients" in value) || Array.isArray(value.clients)) &&
    (!("suppliers" in value) || Array.isArray(value.suppliers)) &&
    (!("inventoryMovements" in value) ||
      Array.isArray(value.inventoryMovements)) &&
    (!("orders" in value) || Array.isArray(value.orders)) &&
    (!("purchaseOrders" in value) || Array.isArray(value.purchaseOrders))
  );
}

function createOrderNumber(value: string) {
  const datePart = value.slice(0, 10).replaceAll("-", "");
  const randomPart = crypto.randomUUID().slice(0, 8).toUpperCase();

  return `PED-${datePart}-${randomPart}`;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
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
