-- 사용자 제품 등록/수정 요청 — 관리자가 승인해야 product 에 반영된다
-- 요청 시점의 입력값을 그대로 보관하므로 product 와 같은 컬럼 구성을 가진다
CREATE TABLE IF NOT EXISTS product_request
(
    id                 INTEGER  PRIMARY KEY AUTOINCREMENT,
    type               TEXT     NOT NULL,
    status             TEXT     NOT NULL DEFAULT 'PENDING',
    user_id            INTEGER  NOT NULL,
    -- 수정 요청(MODIFY)일 때 대상 제품, 등록 요청(REGISTER)이면 NULL
    product_id         INTEGER,
    grade              TEXT     NOT NULL,
    model_number       TEXT,
    name               TEXT     NOT NULL,
    release_year       INTEGER,
    release_month      INTEGER,
    currency           TEXT,
    price              INTEGER,
    manual_url         TEXT,
    source_url         TEXT,
    series             TEXT,
    category_id        INTEGER,
    box_art_path       TEXT,
    box_art_thumb_path TEXT,
    reject_reason      TEXT,
    processed_at       DATETIME,
    processed_by       TEXT,
    created_at         DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at         DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_product_request_user ON product_request (user_id);
CREATE INDEX IF NOT EXISTS idx_product_request_status ON product_request (status);
