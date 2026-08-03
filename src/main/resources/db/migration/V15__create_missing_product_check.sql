CREATE TABLE IF NOT EXISTS missing_product_check
(
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    hash       TEXT     NOT NULL UNIQUE,
    created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);
