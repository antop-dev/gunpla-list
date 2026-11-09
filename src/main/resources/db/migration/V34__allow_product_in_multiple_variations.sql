-- 제품 하나를 여러 보드에 올릴 수 있도록 제약을 보드 단위로 바꾼다
-- SQLite 는 UNIQUE 제약을 ALTER 로 바꿀 수 없으므로 테이블을 새로 만들어 옮긴다
CREATE TABLE variation_node_new
(
    id           TEXT    PRIMARY KEY,
    variation_id TEXT    NOT NULL,
    product_id   INTEGER NOT NULL,
    pos_x        REAL    NOT NULL,
    pos_y        REAL    NOT NULL,
    UNIQUE (variation_id, product_id)
);

INSERT INTO variation_node_new (id, variation_id, product_id, pos_x, pos_y)
SELECT id, variation_id, product_id, pos_x, pos_y
FROM variation_node;

DROP TABLE variation_node;
ALTER TABLE variation_node_new RENAME TO variation_node;

CREATE INDEX IF NOT EXISTS idx_variation_node_variation_id ON variation_node (variation_id);
CREATE INDEX IF NOT EXISTS idx_variation_node_product_id ON variation_node (product_id);

-- 같은 두 제품의 연결선도 보드마다 따로 가질 수 있다
CREATE TABLE variation_link_new
(
    id                TEXT    PRIMARY KEY,
    variation_id      TEXT    NOT NULL,
    parent_product_id INTEGER NOT NULL,
    child_product_id  INTEGER NOT NULL,
    direction         TEXT    NOT NULL DEFAULT 'DOWN',
    UNIQUE (variation_id, parent_product_id, child_product_id)
);

INSERT INTO variation_link_new (id, variation_id, parent_product_id, child_product_id, direction)
SELECT id, variation_id, parent_product_id, child_product_id, direction
FROM variation_link;

DROP TABLE variation_link;
ALTER TABLE variation_link_new RENAME TO variation_link;

CREATE INDEX IF NOT EXISTS idx_variation_link_variation_id ON variation_link (variation_id);
