SELECT
  a.id AS article_id,
  a.name AS article_name,
  c.name AS category_name,
  a.sku,
  a.unit,
  COALESCE(SUM(
    CASE m.type
      WHEN 'in' THEN m.quantity
      WHEN 'out' THEN -m.quantity
      ELSE m.quantity
    END
  ), 0) AS quantity
FROM catalog_articles a
INNER JOIN catalog_categories c ON c.id = a.category_id
LEFT JOIN inventory_movements m ON m.article_id = a.id
GROUP BY a.id, a.name, c.name, a.sku, a.unit
ORDER BY a.name COLLATE NOCASE;
