CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tax_id TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  province TEXT,
  country TEXT,
  payment_terms TEXT,
  bank_account TEXT,
  category TEXT,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  user_id TEXT,
  UNIQUE (user_id, name)
);

ALTER TABLE purchase_orders ADD COLUMN supplier_id TEXT REFERENCES suppliers(id);

CREATE INDEX IF NOT EXISTS idx_suppliers_user_id
  ON suppliers(user_id);

CREATE INDEX IF NOT EXISTS idx_suppliers_name
  ON suppliers(name COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_suppliers_tax_id
  ON suppliers(tax_id);

CREATE INDEX IF NOT EXISTS idx_suppliers_active
  ON suppliers(active);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id
  ON purchase_orders(supplier_id);
