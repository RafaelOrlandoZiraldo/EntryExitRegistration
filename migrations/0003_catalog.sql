CREATE TABLE IF NOT EXISTS catalog_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  user_id TEXT,
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS catalog_articles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT NOT NULL,
  sku TEXT,
  description TEXT,
  unit TEXT,
  price REAL CHECK (price IS NULL OR price >= 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  user_id TEXT,
  FOREIGN KEY (category_id) REFERENCES catalog_categories(id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_categories_user_id
  ON catalog_categories(user_id);

CREATE INDEX IF NOT EXISTS idx_catalog_articles_user_id
  ON catalog_articles(user_id);

CREATE INDEX IF NOT EXISTS idx_catalog_articles_category_id
  ON catalog_articles(category_id);

CREATE INDEX IF NOT EXISTS idx_catalog_articles_active
  ON catalog_articles(active);
