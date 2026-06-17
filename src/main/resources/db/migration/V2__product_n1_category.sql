-- 제품-구분 관계를 N:M(product_category) → N:1(product.category_id)로 단순화
-- 제품당 구분을 하나만 허용하는 기획 변경에 맞춰 마이그레이션

ALTER TABLE product ADD COLUMN category_id INTEGER;

-- 기존 N:M 데이터 중 가장 낮은 category_id 하나만 이관
UPDATE product
SET category_id = (
    SELECT MIN(category_id)
    FROM product_category
    WHERE product_category.product_id = product.id
);

DROP INDEX IF EXISTS idx_product_category_product;
DROP INDEX IF EXISTS idx_product_category_category;
DROP TABLE IF EXISTS product_category;
