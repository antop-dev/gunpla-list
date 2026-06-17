CREATE TABLE IF NOT EXISTS admin_account
(
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    username   TEXT     NOT NULL UNIQUE,
    password   TEXT     NOT NULL,
    created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS category
(
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    name       TEXT     NOT NULL UNIQUE,
    color      TEXT     NOT NULL DEFAULT '#6c757d',
    sort_order INTEGER  NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product
(
    id                  INTEGER  PRIMARY KEY AUTOINCREMENT,
    grade               TEXT     NOT NULL,
    box_art_path        TEXT,
    box_art_thumb_path  TEXT,
    model_number        TEXT,
    name                TEXT     NOT NULL,
    release_year        INTEGER,
    release_month       INTEGER,
    currency            TEXT,
    price               INTEGER,
    created_at          DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at          DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_category
(
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    UNIQUE (product_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_product_category_product ON product_category (product_id);
CREATE INDEX IF NOT EXISTS idx_product_category_category ON product_category (category_id);

CREATE TABLE IF NOT EXISTS user_account
(
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    google_id  TEXT     NOT NULL UNIQUE,
    email      TEXT,
    name       TEXT,
    picture    TEXT,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_product
(
    id                INTEGER  PRIMARY KEY AUTOINCREMENT,
    user_id           INTEGER  NOT NULL,
    product_id        INTEGER  NOT NULL,
    owned             INTEGER  NOT NULL DEFAULT 0,
    purchase_date     TEXT,
    purchase_place    TEXT,
    purchase_currency TEXT,
    purchase_price    INTEGER,
    decal             TEXT,
    created_at        DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at        DATETIME NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_user_product_user ON user_product (user_id);
CREATE INDEX IF NOT EXISTS idx_user_product_product ON user_product (product_id);
