ALTER TABLE product ADD COLUMN category_id INTEGER;

UPDATE product
SET category_id = (
    SELECT MIN(category_id)
    FROM product_category
    WHERE product_category.product_id = product.id
);

DROP INDEX IF EXISTS idx_product_category_product;
DROP INDEX IF EXISTS idx_product_category_category;
DROP TABLE IF EXISTS product_category;
