-- 제품 소프트 삭제 플래그 추가
-- 물리 삭제 시 user_product 의 product_id 참조가 고아가 되므로 논리 삭제 방식 채택
-- (SQLite 외래키 제약은 기본 OFF 이므로 참조 무결성을 애플리케이션에서 보장)
ALTER TABLE product ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;
