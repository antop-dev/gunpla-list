-- purchase_date 컬럼 타입을 TEXT → DATE 로 변경하기 위한 테이블 재생성 3단계 중 1단계 (DDL)
-- SQLite 는 ALTER COLUMN 을 지원하지 않으므로 새 테이블 생성 → 데이터 이관(V9) → 교체(V10) 순으로 진행
-- Flyway 는 DDL 과 DML 을 같은 트랜잭션에 섞으면 오류가 발생하므로 파일을 분리
CREATE TABLE user_product_new
(
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           INTEGER  NOT NULL,
    product_id        INTEGER  NOT NULL,
    owned             INTEGER  NOT NULL DEFAULT 0,
    -- DATE 타입으로 선언하여 JPA LocalDate 바인딩 사용 (V1 에서는 TEXT 였음)
    purchase_date     DATE,
    purchase_place    TEXT,
    purchase_currency TEXT,
    purchase_price    INTEGER,
    decal             TEXT,
    created_at        DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at        DATETIME NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, product_id)
);
