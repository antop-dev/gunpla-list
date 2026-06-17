-- 3단계 중 2단계 (DML): 기존 데이터를 새 테이블로 이관
-- purchase_date 는 null 로 초기화 — 기존 TEXT 값이 DATE 포맷과 다를 수 있어 변환 대신 초기화 선택
INSERT INTO user_product_new (user_id, product_id, owned, purchase_date, purchase_place, purchase_currency,
                              purchase_price, decal, created_at, updated_at)
SELECT user_id, product_id, owned, null, purchase_place, purchase_currency, purchase_price, decal, created_at, updated_at
FROM user_product;
