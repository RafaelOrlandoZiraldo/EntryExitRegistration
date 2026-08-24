import type { AuthSession } from "./types";

export interface Supplier {
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

export interface SupplierInput {
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

interface SupplierRow {
  id: string;
  name: string;
  tax_id: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  payment_terms: string | null;
  bank_account: string | null;
  category: string | null;
  notes: string | null;
  active: number;
  created_at: string;
  updated_at: string;
  user_id: string | null;
}

export async function listSuppliers(db: D1Database, session: AuthSession) {
  const statement =
    session.role === "admin"
      ? db.prepare(
          `SELECT id, name, tax_id, contact_name, email, phone, address, city,
                  province, country, payment_terms, bank_account, category,
                  notes, active, created_at, updated_at, user_id
           FROM suppliers
           ORDER BY active DESC, name COLLATE NOCASE`
        )
      : db
          .prepare(
            `SELECT id, name, tax_id, contact_name, email, phone, address, city,
                    province, country, payment_terms, bank_account, category,
                    notes, active, created_at, updated_at, user_id
             FROM suppliers
             WHERE user_id = ?
             ORDER BY active DESC, name COLLATE NOCASE`
          )
          .bind(session.userId);
  const result = await statement.all<SupplierRow>();

  return (result.results ?? []).map(mapSupplierRow);
}

export async function createSupplier(
  db: D1Database,
  input: SupplierInput,
  session: AuthSession
) {
  assertUserCanMutateSuppliers(session);

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  try {
    await db
      .prepare(
        `INSERT INTO suppliers
         (id, name, tax_id, contact_name, email, phone, address, city, province,
          country, payment_terms, bank_account, category, notes, active,
          created_at, updated_at, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        input.name,
        input.taxId ?? null,
        input.contactName ?? null,
        input.email ?? null,
        input.phone ?? null,
        input.address ?? null,
        input.city ?? null,
        input.province ?? null,
        input.country ?? null,
        input.paymentTerms ?? null,
        input.bankAccount ?? null,
        input.category ?? null,
        input.notes ?? null,
        input.active === false ? 0 : 1,
        now,
        now,
        session.userId
      )
      .run();
  } catch (error) {
    throwUniqueSupplierNameError(error);
    throw error;
  }

  const supplier = await getSupplier(db, id, session);

  if (!supplier) {
    throw new Error("Supplier was not created.");
  }

  return supplier;
}

export async function updateSupplier(
  db: D1Database,
  id: string,
  input: SupplierInput,
  session: AuthSession
) {
  assertUserCanMutateSuppliers(session);

  const now = new Date().toISOString();

  try {
    await db
      .prepare(
        `UPDATE suppliers
         SET name = ?, tax_id = ?, contact_name = ?, email = ?, phone = ?,
             address = ?, city = ?, province = ?, country = ?,
             payment_terms = ?, bank_account = ?, category = ?, notes = ?,
             active = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .bind(
        input.name,
        input.taxId ?? null,
        input.contactName ?? null,
        input.email ?? null,
        input.phone ?? null,
        input.address ?? null,
        input.city ?? null,
        input.province ?? null,
        input.country ?? null,
        input.paymentTerms ?? null,
        input.bankAccount ?? null,
        input.category ?? null,
        input.notes ?? null,
        input.active === false ? 0 : 1,
        now,
        id,
        session.userId
      )
      .run();
  } catch (error) {
    throwUniqueSupplierNameError(error);
    throw error;
  }

  const supplier = await getSupplier(db, id, session);

  if (!supplier) {
    throw new Error("Not found.");
  }

  return supplier;
}

export async function deleteSupplier(
  db: D1Database,
  id: string,
  session: AuthSession
) {
  assertUserCanMutateSuppliers(session);

  const order = await db
    .prepare(
      "SELECT id FROM purchase_orders WHERE supplier_id = ? AND user_id = ? LIMIT 1"
    )
    .bind(id, session.userId)
    .first<{ id: string }>();

  if (order) {
    throw new Error("Supplier has purchase orders.");
  }

  await db
    .prepare("DELETE FROM suppliers WHERE id = ? AND user_id = ?")
    .bind(id, session.userId)
    .run();
}

export function readSupplierInput(value: unknown): SupplierInput | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Partial<SupplierInput>;
  const name = readRequiredText(candidate.name);

  if (!name) {
    return null;
  }

  return {
    name,
    ...readOptionalTextProperty("taxId", candidate.taxId),
    ...readOptionalTextProperty("contactName", candidate.contactName),
    ...readOptionalTextProperty("email", candidate.email),
    ...readOptionalTextProperty("phone", candidate.phone),
    ...readOptionalTextProperty("address", candidate.address),
    ...readOptionalTextProperty("city", candidate.city),
    ...readOptionalTextProperty("province", candidate.province),
    ...readOptionalTextProperty("country", candidate.country),
    ...readOptionalTextProperty("paymentTerms", candidate.paymentTerms),
    ...readOptionalTextProperty("bankAccount", candidate.bankAccount),
    ...readOptionalTextProperty("category", candidate.category),
    ...readOptionalTextProperty("notes", candidate.notes),
    ...(typeof candidate.active === "boolean" ? { active: candidate.active } : {})
  };
}

export async function assertActiveSupplierBelongsToUser(
  db: D1Database,
  id: string,
  session: AuthSession
) {
  const supplier = await db
    .prepare("SELECT id FROM suppliers WHERE id = ? AND user_id = ? AND active = 1")
    .bind(id, session.userId)
    .first<{ id: string }>();

  if (!supplier) {
    throw new Error("Invalid supplier.");
  }
}

async function getSupplier(db: D1Database, id: string, session: AuthSession) {
  const row = await db
    .prepare(
      `SELECT id, name, tax_id, contact_name, email, phone, address, city,
              province, country, payment_terms, bank_account, category, notes,
              active, created_at, updated_at, user_id
       FROM suppliers
       WHERE id = ? AND user_id = ?`
    )
    .bind(id, session.userId)
    .first<SupplierRow>();

  return row ? mapSupplierRow(row) : null;
}

function mapSupplierRow(row: SupplierRow): Supplier {
  return {
    id: row.id,
    name: row.name,
    ...(row.tax_id ? { taxId: row.tax_id } : {}),
    ...(row.contact_name ? { contactName: row.contact_name } : {}),
    ...(row.email ? { email: row.email } : {}),
    ...(row.phone ? { phone: row.phone } : {}),
    ...(row.address ? { address: row.address } : {}),
    ...(row.city ? { city: row.city } : {}),
    ...(row.province ? { province: row.province } : {}),
    ...(row.country ? { country: row.country } : {}),
    ...(row.payment_terms ? { paymentTerms: row.payment_terms } : {}),
    ...(row.bank_account ? { bankAccount: row.bank_account } : {}),
    ...(row.category ? { category: row.category } : {}),
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

function throwUniqueSupplierNameError(error: unknown) {
  if (
    error instanceof Error &&
    error.message.toLowerCase().includes("unique")
  ) {
    throw new Error("Supplier name exists.");
  }
}

function assertUserCanMutateSuppliers(session: AuthSession) {
  if (session.role !== "user") {
    throw new Error("Forbidden.");
  }
}
