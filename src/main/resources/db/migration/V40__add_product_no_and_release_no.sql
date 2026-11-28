-- 품번: 반다이 제품 고유 번호 (7자리 관리 번호 예: 5063123, 또는 JAN 코드 13자리)
-- 발매번호: 등급별 라인업 넘버링 (예: HGUC 241, RG 40, RE/100 01)
ALTER TABLE product ADD COLUMN product_no TEXT;
ALTER TABLE product ADD COLUMN release_no TEXT;
