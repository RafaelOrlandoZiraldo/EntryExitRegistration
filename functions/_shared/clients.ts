import type { AuthSession } from "./types";

export interface Client {
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

export interface ClientInput {
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  active?: boolean;
}

interface ClientRow {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  active: number;
  created_at: string;
  updated_at: string;
  user_id: string | null;
}

export async function listClients(db: D1Database, session: AuthSession) {
  const statement =
    session.role === "admin"
      ? db.prepare(
          `SELECT id, name, document, email, phone, address, notes, active,
                  created_at, updated_at, user_id
           FROM clients
           ORDER BY active DESC, name COLLATE NOCASE`
        )
      : db
          .prepare(
            `SELECT id, name, document, email, phone, address, notes, active,
                    created_at, updated_at, user_id
             FROM clients
             WHERE user_id = ?
             ORDER BY active DESC, name COLLATE NOCASE`
          )
          .bind(session.userId);
  const result = await statement.all<ClientRow>();

  return (result.results ?? []).map(mapClientRow);
}

export async function createClient(
  db: D1Database,
  input: ClientInput,
  session: AuthSession
) {
  assertUserCanMutateClients(session);

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  try {
    await db
      .prepare(
        `INSERT INTO clients
         (id, name, document, email, phone, address, notes, active,
          created_at, updated_at, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        input.name,
        input.document ?? null,
        input.email ?? null,
        input.phone ?? null,
        input.address ?? null,
        input.notes ?? null,
        input.active === false ? 0 : 1,
        now,
        now,
        session.userId
      )
      .run();
  } catch (error) {
    throwUniqueClientNameError(error);
    throw error;
  }

  const client = await getClient(db, id, session);

  if (!client) {
    throw new Error("Client was not created.");
  }

  return client;
}

export async function updateClient(
  db: D1Database,
  id: string,
  input: ClientInput,
  session: AuthSession
) {
  assertUserCanMutateClients(session);

  const now = new Date().toISOString();

  try {
    await db
      .prepare(
        `UPDATE clients
         SET name = ?, document = ?, email = ?, phone = ?, address = ?,
             notes = ?, active = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .bind(
        input.name,
        input.document ?? null,
        input.email ?? null,
        input.phone ?? null,
        input.address ?? null,
        input.notes ?? null,
        input.active === false ? 0 : 1,
        now,
        id,
        session.userId
      )
      .run();
  } catch (error) {
    throwUniqueClientNameError(error);
    throw error;
  }

  const client = await getClient(db, id, session);

  if (!client) {
    throw new Error("Not found.");
  }

  return client;
}

export async function deleteClient(
  db: D1Database,
  id: string,
  session: AuthSession
) {
  assertUserCanMutateClients(session);

  const order = await db
    .prepare("SELECT id FROM orders WHERE customer_id = ? AND user_id = ? LIMIT 1")
    .bind(id, session.userId)
    .first<{ id: string }>();

  if (order) {
    throw new Error("Client has orders.");
  }

  await db
    .prepare("DELETE FROM clients WHERE id = ? AND user_id = ?")
    .bind(id, session.userId)
    .run();
}

export function readClientInput(value: unknown): ClientInput | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Partial<ClientInput>;
  const name = readRequiredText(candidate.name);

  if (!name) {
    return null;
  }

  return {
    name,
    ...readOptionalTextProperty("document", candidate.document),
    ...readOptionalTextProperty("email", candidate.email),
    ...readOptionalTextProperty("phone", candidate.phone),
    ...readOptionalTextProperty("address", candidate.address),
    ...readOptionalTextProperty("notes", candidate.notes),
    ...(typeof candidate.active === "boolean" ? { active: candidate.active } : {})
  };
}

export async function assertActiveClientBelongsToUser(
  db: D1Database,
  id: string,
  session: AuthSession
) {
  const client = await db
    .prepare("SELECT id FROM clients WHERE id = ? AND user_id = ? AND active = 1")
    .bind(id, session.userId)
    .first<{ id: string }>();

  if (!client) {
    throw new Error("Invalid client.");
  }
}

async function getClient(db: D1Database, id: string, session: AuthSession) {
  const row = await db
    .prepare(
      `SELECT id, name, document, email, phone, address, notes, active,
              created_at, updated_at, user_id
       FROM clients
       WHERE id = ? AND user_id = ?`
    )
    .bind(id, session.userId)
    .first<ClientRow>();

  return row ? mapClientRow(row) : null;
}

function mapClientRow(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    ...(row.document ? { document: row.document } : {}),
    ...(row.email ? { email: row.email } : {}),
    ...(row.phone ? { phone: row.phone } : {}),
    ...(row.address ? { address: row.address } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.user_id ? { userId: row.user_id } : {})
  };
}

function readRequiredText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function readOptionalTextProperty(key: string, value: unknown) {
  if (typeof value !== "string") {
    return {};
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? { [key]: trimmed } : {};
}

function throwUniqueClientNameError(error: unknown) {
  if (
    error instanceof Error &&
    error.message.toLowerCase().includes("unique")
  ) {
    throw new Error("Client name exists.");
  }
}

function assertUserCanMutateClients(session: AuthSession) {
  if (session.role !== "user") {
    throw new Error("Forbidden.");
  }
}
