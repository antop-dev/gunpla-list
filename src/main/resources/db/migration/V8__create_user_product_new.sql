-- Step 1: Create new user_product table with purchase_date DATE type
-- SQLite does not support ALTER COLUMN, so we recreate the table
CREATE TABLE user_product_new
(
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           INTEGER  NOT NULL,
    product_id        INTEGER  NOT NULL,
    owned             INTEGER  NOT NULL DEFAULT 0,
    purchase_date     DATE,
    purchase_place    TEXT,
    purchase_currency TEXT,
    purchase_price    INTEGER,
    decal             TEXT,
    created_at        DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at        DATETIME NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, product_id)
);
