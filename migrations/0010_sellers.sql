CREATE TABLE IF NOT EXISTS users_next (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user', 'seller')),
  password_algorithm TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL CHECK (password_iterations > 0),
  created_at TEXT NOT NULL
);

INSERT INTO users_next
  (id, username, role, password_algorithm, password_hash, password_salt,
   password_iterations, created_at)
SELECT id, username, role, password_algorithm, password_hash, password_salt,
       password_iterations, created_at
FROM users;

DROP TABLE users;

ALTER TABLE users_next RENAME TO users;

CREATE TABLE IF NOT EXISTS sales_profiles (
  user_id TEXT PRIMARY KEY,
  catalog_user_id TEXT NOT NULL,
  commission_rate REAL NOT NULL DEFAULT 0 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  bonus_goal_amount REAL NOT NULL DEFAULT 0 CHECK (bonus_goal_amount >= 0),
  bonus_amount REAL NOT NULL DEFAULT 0 CHECK (bonus_amount >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (catalog_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sales_profiles_catalog_user_id
  ON sales_profiles(catalog_user_id);

CREATE INDEX IF NOT EXISTS idx_users_role
  ON users(role);
