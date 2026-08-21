INSERT OR IGNORE INTO transactions (
  id,
  type,
  date,
  amount,
  category,
  description,
  payment_method,
  notes,
  created_at,
  updated_at,
  user_id
)
SELECT
  'purchase-' || po.id,
  'expense',
  substr(COALESCE(po.received_at, po.updated_at, po.created_at), 1, 10),
  ROUND(SUM(i.quantity * i.unit_cost), 2),
  'other_expense',
  'Orden de compra ' || po.order_number || ' - ' || po.supplier_name,
  'bank_transfer',
  CASE
    WHEN po.payment_terms IS NOT NULL AND po.payment_terms <> ''
      THEN 'Condiciones: ' || po.payment_terms || '. Orden de compra ' || po.order_number || ' (' || po.id || ')'
    ELSE 'Orden de compra ' || po.order_number || ' (' || po.id || ')'
  END,
  COALESCE(po.received_at, po.updated_at, po.created_at),
  COALESCE(po.received_at, po.updated_at, po.created_at),
  po.user_id
FROM purchase_orders po
INNER JOIN purchase_order_items i ON i.purchase_order_id = po.id
WHERE po.status = 'received'
  AND NOT EXISTS (
    SELECT 1
    FROM transactions t
    WHERE t.user_id = po.user_id
      AND t.notes LIKE '%' || po.id || '%'
  )
GROUP BY po.id;
