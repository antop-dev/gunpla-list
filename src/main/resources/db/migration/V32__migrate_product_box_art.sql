-- 기존 박스아트(product.box_art_path / box_art_thumb_path)를 각 제품의 첫 번째 이미지로 옮긴다
INSERT INTO product_box_art (product_id, box_art_path, box_art_thumb_path, sort_order, created_at)
SELECT id, box_art_path, box_art_thumb_path, 0, updated_at
FROM product
WHERE box_art_path IS NOT NULL;
