import type { AuthSession } from "./types";

export interface CatalogCategory {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

export interface CatalogArticle {
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

interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  user_id: string | null;
}

interface ArticleRow {
  id: string;
  name: string;
  category_id: string;
  category_name: string;
  sku: string | null;
  description: string | null;
  unit: string | null;
  price: number | null;
  active: number;
  created_at: string;
  updated_at: string;
  user_id: string | null;
}

export interface CategoryInput {
  name: string;
  description?: string;
}

export interface ArticleInput {
  name: string;
  categoryId: string;
  sku?: string;
  description?: string;
  unit?: string;
  price?: number;
  active?: boolean;
}

export async function listCatalog(db: D1Database, session: AuthSession) {
  return {
    categories: await listCategories(db, session),
    articles: await listArticles(db, session)
  };
}

export async function listCategories(db: D1Database, session: AuthSession) {
  const statement =
    session.role === "admin"
      ? db.prepare(
          `SELECT id, name, description, created_at, updated_at, user_id
           FROM catalog_categories
           ORDER BY name COLLATE NOCASE`
        )
      : db
          .prepare(
            `SELECT id, name, description, created_at, updated_at, user_id
             FROM catalog_categories
             WHERE user_id = ?
             ORDER BY name COLLATE NOCASE`
          )
          .bind(session.userId);

  const result = await statement.all<CategoryRow>();

  return (result.results ?? []).map(mapCategoryRow);
}

export async function listArticles(db: D1Database, session: AuthSession) {
  const statement =
    session.role === "admin"
      ? db.prepare(
          `SELECT a.id, a.name, a.category_id, c.name AS category_name, a.sku,
                  a.description, a.unit, a.price, a.active, a.created_at,
                  a.updated_at, a.user_id
           FROM catalog_articles a
           INNER JOIN catalog_categories c ON c.id = a.category_id
           ORDER BY a.name COLLATE NOCASE`
        )
      : db
          .prepare(
            `SELECT a.id, a.name, a.category_id, c.name AS category_name, a.sku,
                    a.description, a.unit, a.price, a.active, a.created_at,
                    a.updated_at, a.user_id
             FROM catalog_articles a
             INNER JOIN catalog_categories c ON c.id = a.category_id
             WHERE a.user_id = ?
             ORDER BY a.name COLLATE NOCASE`
          )
          .bind(session.userId);

  const result = await statement.all<ArticleRow>();

  return (result.results ?? []).map(mapArticleRow);
}

export async function createCategory(
  db: D1Database,
  input: CategoryInput,
  session: AuthSession
) {
  assertUserCanMutateCatalog(session);

  const now = new Date().toISOString();
  const category: CatalogCategory = {
    id: crypto.randomUUID(),
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    createdAt: now,
    updatedAt: now,
    userId: session.userId
  };

  await db
    .prepare(
      `INSERT INTO catalog_categories
       (id, name, description, created_at, updated_at, user_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(
      category.id,
      category.name,
      category.description ?? null,
      category.createdAt,
      category.updatedAt,
      session.userId
    )
    .run();

  return category;
}

export async function updateCategory(
  db: D1Database,
  id: string,
  input: CategoryInput,
  session: AuthSession
) {
  assertUserCanMutateCatalog(session);

  const now = new Date().toISOString();

  await db
    .prepare(
      `UPDATE catalog_categories
       SET name = ?, description = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    )
    .bind(input.name, input.description ?? null, now, id, session.userId)
    .run();

  const category = await getCategory(db, id, session);

  if (!category) {
    throw new Error("Not found.");
  }

  return category;
}

export async function deleteCategory(
  db: D1Database,
  id: string,
  session: AuthSession
) {
  assertUserCanMutateCatalog(session);

  const article = await db
    .prepare(
      "SELECT id FROM catalog_articles WHERE category_id = ? AND user_id = ? LIMIT 1"
    )
    .bind(id, session.userId)
    .first<{ id: string }>();

  if (article) {
    throw new Error("Category has articles.");
  }

  await db
    .prepare("DELETE FROM catalog_categories WHERE id = ? AND user_id = ?")
    .bind(id, session.userId)
    .run();
}

export async function createArticle(
  db: D1Database,
  input: ArticleInput,
  session: AuthSession
) {
  assertUserCanMutateCatalog(session);
  await assertCategoryBelongsToUser(db, input.categoryId, session);

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO catalog_articles
       (id, name, category_id, sku, description, unit, price, active,
        created_at, updated_at, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.name,
      input.categoryId,
      input.sku ?? null,
      input.description ?? null,
      input.unit ?? null,
      input.price ?? null,
      input.active === false ? 0 : 1,
      now,
      now,
      session.userId
    )
    .run();

  const article = await getArticle(db, id, session);

  if (!article) {
    throw new Error("Article was not created.");
  }

  return article;
}

export async function updateArticle(
  db: D1Database,
  id: string,
  input: ArticleInput,
  session: AuthSession
) {
  assertUserCanMutateCatalog(session);
  await assertCategoryBelongsToUser(db, input.categoryId, session);

  const now = new Date().toISOString();

  await db
    .prepare(
      `UPDATE catalog_articles
       SET name = ?, category_id = ?, sku = ?, description = ?, unit = ?,
           price = ?, active = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    )
    .bind(
      input.name,
      input.categoryId,
      input.sku ?? null,
      input.description ?? null,
      input.unit ?? null,
      input.price ?? null,
      input.active === false ? 0 : 1,
      now,
      id,
      session.userId
    )
    .run();

  const article = await getArticle(db, id, session);

  if (!article) {
    throw new Error("Not found.");
  }

  return article;
}

export async function deleteArticle(
  db: D1Database,
  id: string,
  session: AuthSession
) {
  assertUserCanMutateCatalog(session);

  await db
    .prepare("DELETE FROM catalog_articles WHERE id = ? AND user_id = ?")
    .bind(id, session.userId)
    .run();
}

export function readCategoryInput(value: unknown): CategoryInput | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Partial<CategoryInput>;
  const name = readRequiredText(candidate.name);

  if (!name) {
    return null;
  }

  return {
    name,
    ...readOptionalTextProperty("description", candidate.description)
  };
}

export function readArticleInput(value: unknown): ArticleInput | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Partial<ArticleInput>;
  const name = readRequiredText(candidate.name);
  const categoryId = readRequiredText(candidate.categoryId);

  if (!name || !categoryId) {
    return null;
  }

  if (
    candidate.price !== undefined &&
    (typeof candidate.price !== "number" || candidate.price < 0)
  ) {
    return null;
  }

  return {
    name,
    categoryId,
    ...readOptionalTextProperty("sku", candidate.sku),
    ...readOptionalTextProperty("description", candidate.description),
    ...readOptionalTextProperty("unit", candidate.unit),
    ...(typeof candidate.price === "number" ? { price: candidate.price } : {}),
    ...(typeof candidate.active === "boolean" ? { active: candidate.active } : {})
  };
}

async function getCategory(
  db: D1Database,
  id: string,
  session: AuthSession
) {
  const row = await db
    .prepare(
      `SELECT id, name, description, created_at, updated_at, user_id
       FROM catalog_categories
       WHERE id = ? AND user_id = ?`
    )
    .bind(id, session.userId)
    .first<CategoryRow>();

  return row ? mapCategoryRow(row) : null;
}

async function getArticle(db: D1Database, id: string, session: AuthSession) {
  const row = await db
    .prepare(
      `SELECT a.id, a.name, a.category_id, c.name AS category_name, a.sku,
              a.description, a.unit, a.price, a.active, a.created_at,
              a.updated_at, a.user_id
       FROM catalog_articles a
       INNER JOIN catalog_categories c ON c.id = a.category_id
       WHERE a.id = ? AND a.user_id = ?`
    )
    .bind(id, session.userId)
    .first<ArticleRow>();

  return row ? mapArticleRow(row) : null;
}

async function assertCategoryBelongsToUser(
  db: D1Database,
  id: string,
  session: AuthSession
) {
  const category = await db
    .prepare("SELECT id FROM catalog_categories WHERE id = ? AND user_id = ?")
    .bind(id, session.userId)
    .first<{ id: string }>();

  if (!category) {
    throw new Error("Invalid category.");
  }
}

function mapCategoryRow(row: CategoryRow): CatalogCategory {
  return {
    id: row.id,
    name: row.name,
    ...(row.description ? { description: row.description } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.user_id ? { userId: row.user_id } : {})
  };
}

function mapArticleRow(row: ArticleRow): CatalogArticle {
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id,
    categoryName: row.category_name,
    ...(row.sku ? { sku: row.sku } : {}),
    ...(row.description ? { description: row.description } : {}),
    ...(row.unit ? { unit: row.unit } : {}),
    ...(row.price !== null ? { price: row.price } : {}),
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

function assertUserCanMutateCatalog(session: AuthSession) {
  if (session.role !== "user") {
    throw new Error("Forbidden.");
  }
}
