-- 판매제품 제품별 알림을 "기본 켬"으로 바꾼다 — 켠 제품(on_sale_alert) 대신 사용자가 알림을 끈 제품만 저장한다
-- 행이 없으면 알림 켬이므로, 크롤링으로 새로 추가된 제품도 별도 처리 없이 모든 사용자에게 알림 켬 상태가 된다
-- 기존 on_sale_alert(켠 제품 목록)는 새 기준에서 기본값과 같아 옮길 필요가 없으므로 그대로 삭제한다
CREATE TABLE IF NOT EXISTS on_sale_alert_off
(
    id           INTEGER  PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER  NOT NULL,
    product_hash TEXT     NOT NULL,
    created_at   DATETIME NOT NULL,
    UNIQUE (user_id, product_hash)
);

CREATE INDEX IF NOT EXISTS idx_on_sale_alert_off_product_hash ON on_sale_alert_off (product_hash);

DROP TABLE IF EXISTS on_sale_alert;
