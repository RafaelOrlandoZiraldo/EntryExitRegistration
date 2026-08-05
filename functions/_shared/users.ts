import type { AppUser, Env, UserRole } from "./types";

interface UserRow {
  id: string;
  username: string;
  role: UserRole;
  password_algorithm: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
  created_at: string;
}

export interface UserPasswordConfig {
  passwordAlgorithm: string;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
}

export interface StoredUser extends AppUser, UserPasswordConfig {}

export async function ensureBootstrapAdmin(env: Env) {
  const existing = await findUserByUsername(env.DB, env.AUTH_USERNAME);

  if (existing || !isBootstrapAuthConfigPresent(env)) {
    return;
  }

  await createUser(env.DB, {
    id: "admin-user",
    username: env.AUTH_USERNAME,
    role: "admin",
    passwordAlgorithm: env.AUTH_PASSWORD_ALGORITHM ?? "sha256",
    passwordHash: env.AUTH_PASSWORD_HASH,
    passwordSalt: env.AUTH_PASSWORD_SALT,
    passwordIterations: Number(env.AUTH_PASSWORD_ITERATIONS),
    createdAt: new Date().toISOString()
  });
}

export async function findUserByUsername(db: D1Database, username: string) {
  const row = await db
    .prepare(
      `SELECT id, username, role, password_algorithm, password_hash,
              password_salt, password_iterations, created_at
       FROM users
       WHERE username = ?`
    )
    .bind(username)
    .first<UserRow>();

  return row ? mapUserRow(row) : null;
}

export async function listUsers(db: D1Database) {
  const result = await db
    .prepare(
      `SELECT id, username, role, password_algorithm, password_hash,
              password_salt, password_iterations, created_at
       FROM users
       ORDER BY created_at DESC`
    )
    .all<UserRow>();

  return (result.results ?? []).map(mapUserRow);
}

export async function createUser(
  db: D1Database,
  user: StoredUser & { createdAt: string }
) {
  await db
    .prepare(
      `INSERT INTO users
       (id, username, role, password_algorithm, password_hash, password_salt,
        password_iterations, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      user.id,
      user.username,
      user.role,
      user.passwordAlgorithm,
      user.passwordHash,
      user.passwordSalt,
      user.passwordIterations,
      user.createdAt
    )
    .run();
}

function mapUserRow(row: UserRow): StoredUser {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    passwordAlgorithm: row.password_algorithm,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    passwordIterations: row.password_iterations,
    createdAt: row.created_at
  };
}

function isBootstrapAuthConfigPresent(env: Env) {
  return Boolean(
    env.AUTH_USERNAME &&
      env.AUTH_PASSWORD_HASH &&
      env.AUTH_PASSWORD_SALT &&
      env.AUTH_PASSWORD_ITERATIONS
  );
}
