-- 제품 박스아트를 여러 장 등록할 수 있도록 product 의 단일 컬럼(box_art_path / box_art_thumb_path)을 별도 테이블로 분리한다
-- sort_order 오름차순으로 보여주며, 첫 번째 이미지가 그리드 썸네일 등에 쓰이는 대표 이미지가 된다
-- 경로 컬럼에는 기존과 동일하게 박스아트 디렉토리 안의 파일명만 저장한다
-- 기존 데이터 이관은 V32, product 의 기존 컬럼 삭제는 V33 에서 한다 (DDL 과 DML 을 한 파일에 섞지 않음)
CREATE TABLE IF NOT EXISTS product_box_art
(
    id                 INTEGER  PRIMARY KEY AUTOINCREMENT,
    product_id         INTEGER  NOT NULL,
    box_art_path       TEXT     NOT NULL,
    box_art_thumb_path TEXT,
    sort_order         INTEGER  NOT NULL,
    created_at         DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_box_art_product_id ON product_box_art (product_id, sort_order);
