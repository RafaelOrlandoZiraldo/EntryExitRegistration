INSERT OR IGNORE INTO catalog_categories
  (id, name, description, created_at, updated_at, user_id)
VALUES
  ('catalog-category-food', 'Alimentos', 'Articulos de consumo diario', datetime('now'), datetime('now'), 'admin-user'),
  ('catalog-category-cleaning', 'Limpieza', 'Productos de limpieza del hogar', datetime('now'), datetime('now'), 'admin-user');

INSERT OR IGNORE INTO catalog_articles
  (id, name, category_id, sku, description, unit, price, active, created_at, updated_at, user_id)
VALUES
  ('catalog-article-rice', 'Arroz largo fino', 'catalog-category-food', 'ALM-001', 'Paquete de arroz por kilo', 'kg', 1500, 1, datetime('now'), datetime('now'), 'admin-user'),
  ('catalog-article-detergent', 'Detergente', 'catalog-category-cleaning', 'LIM-001', 'Detergente concentrado', 'unidad', 2200, 1, datetime('now'), datetime('now'), 'admin-user');
