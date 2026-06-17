-- Step 3: Replace old table with new table and recreate indexes
DROP TABLE user_product;
ALTER TABLE user_product_new RENAME TO user_product;

CREATE INDEX IF NOT EXISTS idx_user_product_user ON user_product (user_id);
CREATE INDEX IF NOT EXISTS idx_user_product_product ON user_product (product_id);
