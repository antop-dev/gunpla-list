-- 제품 정보의 원출처(공식 사이트, 뉴스 등) 링크 저장용 컬럼 추가
ALTER TABLE product ADD COLUMN source_url TEXT;
