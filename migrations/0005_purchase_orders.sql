CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_contact TEXT,
  expected_date TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'received', 'cancelled')),
  payment_terms TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  received_at TEXT,
  inventory_posted_at TEXT,
  user_id TEXT
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id TEXT PRIMARY KEY,
  purchase_order_id TEXT NOT NULL,
  article_id TEXT NOT NULL,
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit_cost REAL NOT NULL CHECK (unit_cost >= 0),
  notes TEXT,
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  FOREIGN KEY (article_id) REFERENCES catalog_articles(id)
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_user_id
  ON purchase_orders(user_id);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_status
  ON purchase_orders(status);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_at
  ON purchase_orders(created_at);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order_id
  ON purchase_order_items(purchase_order_id);

CREATE INDEX IF NOT EXISTS idx_purchase_order_items_article_id
  ON purchase_order_items(article_id);
