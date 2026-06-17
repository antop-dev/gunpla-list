-- 관리자 계정 (form 로그인용, Spring Security의 ROLE_ADMIN 부여)
CREATE TABLE IF NOT EXISTS admin_account
(
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    username   TEXT     NOT NULL UNIQUE,
    -- BCrypt 해시로 저장 (평문 저장 금지)
    password   TEXT     NOT NULL,
    created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- 제품 분류 태그 (색상 포함, 정렬 순서 지정 가능)
CREATE TABLE IF NOT EXISTS category
(
    id         INTEGER  PRIMARY KEY AUTOINCREMENT,
    name       TEXT     NOT NULL UNIQUE,
    -- UI 표시용 hex 색상 코드 (#rrggbb)
    color      TEXT     NOT NULL DEFAULT '#6c757d',
    sort_order INTEGER  NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT (datetime('now'))
);

-- 건프라 제품 마스터 데이터
-- box_art_path / box_art_thumb_path 는 서버 파일시스템 절대경로를 저장하며, URL 변환은 서비스 계층에서 수행
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

-- V2 에서 product.category_id 단일 FK 방식으로 대체되어 삭제됨 (N:M → N:1)
CREATE TABLE IF NOT EXISTS product_category
(
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    UNIQUE (product_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_product_category_product ON product_category (product_id);
CREATE INDEX IF NOT EXISTS idx_product_category_category ON product_category (category_id);

-- Google OAuth2 로그인 사용자 계정 (google_id = OAuth2 "sub" 클레임, 변경되지 않는 고유 식별자)
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

-- 사용자별 제품 보유/구매 정보 (user_id + product_id 쌍은 유일)
-- SQLite 는 BOOLEAN 타입이 없어 owned 를 INTEGER(0/1) 로 저장
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
