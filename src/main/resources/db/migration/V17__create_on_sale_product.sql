CREATE TABLE on_sale_product
(
    hash         TEXT     PRIMARY KEY,
    source       TEXT     NOT NULL,
    grade        TEXT     NOT NULL,
    name         TEXT     NOT NULL,
    status       TEXT     NOT NULL,
    price        NUMERIC,
    currency     TEXT     NOT NULL DEFAULT 'KRW',
    url          TEXT     NOT NULL,
    image_url    TEXT,
    new_since    DATETIME NOT NULL,
    created_at   DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at   DATETIME NOT NULL DEFAULT (datetime('now'))
);
