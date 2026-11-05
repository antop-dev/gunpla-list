-- 박스아트는 product_box_art 로 옮겼으므로(V31~V32) product 의 단일 박스아트 컬럼을 삭제한다
ALTER TABLE product DROP COLUMN box_art_path;
ALTER TABLE product DROP COLUMN box_art_thumb_path;
