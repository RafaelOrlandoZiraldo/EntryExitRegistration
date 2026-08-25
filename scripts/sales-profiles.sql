-- Vendedores y configuracion comercial.
-- Ejecutar despues de migrations/0010_sellers.sql.

SELECT u.id, u.username, u.role, sp.catalog_user_id, owner.username AS catalog_owner,
       sp.commission_rate, sp.bonus_goal_amount, sp.bonus_amount
FROM users u
LEFT JOIN sales_profiles sp ON sp.user_id = u.id
LEFT JOIN users owner ON owner.id = sp.catalog_user_id
WHERE u.role = 'seller'
ORDER BY u.username COLLATE NOCASE;

-- Ejemplo para ajustar la comision y premio de un vendedor existente:
-- INSERT INTO sales_profiles
--   (user_id, catalog_user_id, commission_rate, bonus_goal_amount, bonus_amount,
--    created_at, updated_at)
-- VALUES
--   ('SELLER_USER_ID', 'OPERATIVE_USER_ID', 5, 500000, 25000,
--    datetime('now'), datetime('now'))
-- ON CONFLICT(user_id) DO UPDATE SET
--   catalog_user_id = excluded.catalog_user_id,
--   commission_rate = excluded.commission_rate,
--   bonus_goal_amount = excluded.bonus_goal_amount,
--   bonus_amount = excluded.bonus_amount,
--   updated_at = excluded.updated_at;
