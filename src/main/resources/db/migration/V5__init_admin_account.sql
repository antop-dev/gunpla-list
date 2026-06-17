-- JPA가 epoch milliseconds(정수)로 저장한 created_at을 datetime 텍스트로 변환
UPDATE admin_account
SET created_at = datetime(created_at / 1000, 'unixepoch')
WHERE typeof(created_at) = 'integer';

-- 기본 관리자 계정 (없을 때만 삽입)
INSERT OR IGNORE INTO admin_account (username, password) VALUES ('admin', '{noop}admin123');
