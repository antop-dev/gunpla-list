-- 박스아트 중간 크기 이미지 파일명 (가로 400 px JPEG) — 공유 페이지 카드/상세 팝업 표시용
-- 기존 행은 NULL 로 두며, NULL 이면 응답에서 원본 URL 로 대신한다 (ProductService 참고)
ALTER TABLE product_box_art ADD COLUMN box_art_medium_path TEXT;
