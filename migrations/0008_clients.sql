CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  document TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  user_id TEXT,
  UNIQUE (user_id, name)
);

ALTER TABLE orders ADD COLUMN customer_id TEXT REFERENCES clients(id);

CREATE INDEX IF NOT EXISTS idx_clients_user_id
  ON clients(user_id);

CREATE INDEX IF NOT EXISTS idx_clients_name
  ON clients(name COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_clients_active
  ON clients(active);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id
  ON orders(customer_id);
