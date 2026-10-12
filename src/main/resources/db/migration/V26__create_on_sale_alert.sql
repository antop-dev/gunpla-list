-- 판매제품 모아보기에서 사용자가 제품별로 켠 알림 — 해당 제품이 품절→판매중으로 바뀌면 이메일로 알린다
-- product_hash 는 on_sale_product.hash. 알림은 한 번 보낸 뒤에도 사용자가 끌 때까지 유지된다(재입고될 때마다 알림)
CREATE TABLE IF NOT EXISTS on_sale_alert
(
    id           INTEGER  PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER  NOT NULL,
    product_hash TEXT     NOT NULL,
    created_at   DATETIME NOT NULL,
    UNIQUE (user_id, product_hash)
);

CREATE INDEX IF NOT EXISTS idx_on_sale_alert_product_hash ON on_sale_alert (product_hash);
