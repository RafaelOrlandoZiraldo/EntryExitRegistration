CREATE TABLE IF NOT EXISTS inventory_movements (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjustment')),
  quantity REAL NOT NULL CHECK (quantity <> 0),
  reason TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  user_id TEXT,
  FOREIGN KEY (article_id) REFERENCES catalog_articles(id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_user_id
  ON inventory_movements(user_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_article_id
  ON inventory_movements(article_id);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at
  ON inventory_movements(created_at);
