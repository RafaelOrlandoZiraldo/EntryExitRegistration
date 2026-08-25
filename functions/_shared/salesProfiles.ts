export interface SalesProfile {
  userId: string;
  catalogUserId: string;
  commissionRate: number;
  bonusGoalAmount: number;
  bonusAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SalesProfileInput {
  catalogUserId: string;
  commissionRate: number;
  bonusGoalAmount: number;
  bonusAmount: number;
}

interface SalesProfileRow {
  user_id: string;
  catalog_user_id: string;
  commission_rate: number;
  bonus_goal_amount: number;
  bonus_amount: number;
  created_at: string;
  updated_at: string;
}

export async function getSalesProfile(db: D1Database, userId: string) {
  const row = await db
    .prepare(
      `SELECT user_id, catalog_user_id, commission_rate, bonus_goal_amount,
              bonus_amount, created_at, updated_at
       FROM sales_profiles
       WHERE user_id = ?`
    )
    .bind(userId)
    .first<SalesProfileRow>();

  return row ? mapSalesProfileRow(row) : null;
}

export async function listSalesProfiles(db: D1Database) {
  const result = await db
    .prepare(
      `SELECT user_id, catalog_user_id, commission_rate, bonus_goal_amount,
              bonus_amount, created_at, updated_at
       FROM sales_profiles`
    )
    .all<SalesProfileRow>();

  return (result.results ?? []).map(mapSalesProfileRow);
}

export async function upsertSalesProfile(
  db: D1Database,
  userId: string,
  input: SalesProfileInput
) {
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO sales_profiles
       (user_id, catalog_user_id, commission_rate, bonus_goal_amount,
        bonus_amount, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         catalog_user_id = excluded.catalog_user_id,
         commission_rate = excluded.commission_rate,
         bonus_goal_amount = excluded.bonus_goal_amount,
         bonus_amount = excluded.bonus_amount,
         updated_at = excluded.updated_at`
    )
    .bind(
      userId,
      input.catalogUserId,
      input.commissionRate,
      input.bonusGoalAmount,
      input.bonusAmount,
      now,
      now
    )
    .run();

  const profile = await getSalesProfile(db, userId);

  if (!profile) {
    throw new Error("Sales profile was not created.");
  }

  return profile;
}

export function readSalesProfileInput(value: unknown): SalesProfileInput | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Partial<SalesProfileInput>;

  if (
    typeof candidate.catalogUserId !== "string" ||
    candidate.catalogUserId.trim().length === 0 ||
    typeof candidate.commissionRate !== "number" ||
    !Number.isFinite(candidate.commissionRate) ||
    candidate.commissionRate < 0 ||
    candidate.commissionRate > 100 ||
    typeof candidate.bonusGoalAmount !== "number" ||
    !Number.isFinite(candidate.bonusGoalAmount) ||
    candidate.bonusGoalAmount < 0 ||
    typeof candidate.bonusAmount !== "number" ||
    !Number.isFinite(candidate.bonusAmount) ||
    candidate.bonusAmount < 0
  ) {
    return null;
  }

  return {
    catalogUserId: candidate.catalogUserId.trim(),
    commissionRate: roundMoney(candidate.commissionRate),
    bonusGoalAmount: roundMoney(candidate.bonusGoalAmount),
    bonusAmount: roundMoney(candidate.bonusAmount)
  };
}

export async function resolveCatalogUserId(db: D1Database, user: {
  userId: string;
  role: string;
}) {
  if (user.role !== "seller") {
    return user.userId;
  }

  const profile = await getSalesProfile(db, user.userId);

  return profile?.catalogUserId ?? user.userId;
}

export async function assertUserCanOwnSalesCatalog(
  db: D1Database,
  catalogUserId: string
) {
  const row = await db
    .prepare("SELECT id FROM users WHERE id = ? AND role = 'user'")
    .bind(catalogUserId)
    .first<{ id: string }>();

  if (!row) {
    throw new Error("Invalid catalog user.");
  }
}

function mapSalesProfileRow(row: SalesProfileRow): SalesProfile {
  return {
    userId: row.user_id,
    catalogUserId: row.catalog_user_id,
    commissionRate: row.commission_rate,
    bonusGoalAmount: row.bonus_goal_amount,
    bonusAmount: row.bonus_amount,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
