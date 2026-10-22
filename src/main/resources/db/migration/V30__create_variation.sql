-- 제품 바리에이션(Variation) 구성도 — 일반판에서 파생된 바리에이션 제품들의 가계도를 보드(variation) 단위로 관리한다
-- 보드 하나에 제품 카드(node)를 올리고, 원본 → 바리에이션 방향으로 화살표(link)를 잇는다
-- PK 는 AUTOINCREMENT 대신 ULID(26자 문자열)를 애플리케이션에서 발급한다
CREATE TABLE IF NOT EXISTS variation
(
    id         TEXT     PRIMARY KEY,
    name       TEXT     NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

-- 보드에 올린 제품과 화면 좌표 — 제품 하나는 보드 하나에만 올릴 수 있다 (사용자 화면에서 제품 → 구성도를 바로 찾기 위함)
CREATE TABLE IF NOT EXISTS variation_node
(
    id           TEXT    PRIMARY KEY,
    variation_id TEXT    NOT NULL,
    product_id   INTEGER NOT NULL UNIQUE,
    pos_x        REAL    NOT NULL,
    pos_y        REAL    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_variation_node_variation_id ON variation_node (variation_id);

-- 원본 제품(parent) → 바리에이션 제품(child) 화살표
-- direction: 원본 카드의 어느 변에서 나가는 화살표인지 (UP / RIGHT / DOWN / LEFT), 바리에이션 카드에는 반대쪽 변으로 들어간다
CREATE TABLE IF NOT EXISTS variation_link
(
    id                TEXT    PRIMARY KEY,
    variation_id      TEXT    NOT NULL,
    parent_product_id INTEGER NOT NULL,
    child_product_id  INTEGER NOT NULL,
    direction         TEXT    NOT NULL DEFAULT 'DOWN',
    UNIQUE (parent_product_id, child_product_id)
);

CREATE INDEX IF NOT EXISTS idx_variation_link_variation_id ON variation_link (variation_id);
