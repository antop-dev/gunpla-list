-- 판매제품 스크래핑 이력 — 배치마다 출처(사이트)별로 한 행씩 남겨 관리자 대시보드에서 출처별 수집 상태를 확인한다
-- status: SUCCESS(1건 이상 수집) / EMPTY(예외 없이 0건 — 사이트 구조 변경 의심) / FAILED(예외 발생)
-- 2분 간격 배치라 행이 계속 쌓이므로 OnSaleSyncService 가 보관 기간이 지난 행을 지운다
CREATE TABLE IF NOT EXISTS on_sale_scrape_log
(
    id            INTEGER  PRIMARY KEY AUTOINCREMENT,
    source        TEXT     NOT NULL,
    status        TEXT     NOT NULL,
    item_count    INTEGER  NOT NULL DEFAULT 0,
    error_message TEXT,
    duration_ms   INTEGER  NOT NULL DEFAULT 0,
    started_at    DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_on_sale_scrape_log_started_at ON on_sale_scrape_log (started_at);
CREATE INDEX IF NOT EXISTS idx_on_sale_scrape_log_source ON on_sale_scrape_log (source, started_at);
