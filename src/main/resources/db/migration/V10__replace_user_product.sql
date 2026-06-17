-- 3단계 중 3단계 (DDL): 구 테이블 삭제 후 새 테이블로 교체, 인덱스 재생성
DROP TABLE user_product;
ALTER TABLE user_product_new RENAME TO user_product;

CREATE INDEX IF NOT EXISTS idx_user_product_user ON user_product (user_id);
CREATE INDEX IF NOT EXISTS idx_user_product_product ON user_product (product_id);
