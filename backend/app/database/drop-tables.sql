-- drop-tables.sql — Drops every table of the Ultra Pet database (all data is lost).
--
-- Run it before create-tables.sql to rebuild the database from scratch (`flask reset-db --yes` runs both).
-- Order matters: a table is dropped before every table it references, children first, so each DROP succeeds
-- without CASCADE (CASCADE would silently hide a wrong order). The comment on each line names the tables that must
-- already be gone because they reference it. When a table or a foreign key is added to create-tables.sql, add or
-- move its DROP here. IF EXISTS lets the file run on an empty or half-built database.

BEGIN;

DROP TABLE IF EXISTS order_items;       -- referenced by: nothing
DROP TABLE IF EXISTS orders;            -- referenced by: order_items
DROP TABLE IF EXISTS business_leads;    -- referenced by: nothing
DROP TABLE IF EXISTS price_rules;       -- referenced by: nothing
DROP TABLE IF EXISTS product_suppliers; -- referenced by: nothing
DROP TABLE IF EXISTS product_images;    -- referenced by: nothing
DROP TABLE IF EXISTS products;          -- referenced by: order_items, price_rules, product_suppliers, product_images
DROP TABLE IF EXISTS categories;        -- referenced by: products, price_rules
DROP TABLE IF EXISTS brands;            -- referenced by: products
DROP TABLE IF EXISTS suppliers;         -- referenced by: product_suppliers
DROP TABLE IF EXISTS payment_methods;   -- referenced by: orders
DROP TABLE IF EXISTS settings;          -- referenced by: nothing
DROP TABLE IF EXISTS articles;          -- referenced by: nothing
DROP TABLE IF EXISTS resellers;         -- referenced by: nothing
DROP TABLE IF EXISTS business_users;    -- referenced by: orders, business_leads, price_rules
DROP TABLE IF EXISTS staff_users;       -- referenced by: price_rules
DROP TABLE IF EXISTS app_users;         -- referenced by: business_users, staff_users

COMMIT;
