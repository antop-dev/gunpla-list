-- 보유상품 공유 허용 여부 — 기본은 비공개(0)
-- share_id 는 공유 URL(/share/{share_id})에 쓰는 무작위 ID로, 처음 공유를 허용할 때 만들어지고 이후 공유를 껐다 켜도 유지된다
-- google_id/email 과 무관한 난수라 공유 URL 로 구글 계정을 유추할 수 없다 (ShareService 참고)
ALTER TABLE user_account ADD COLUMN share_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_account ADD COLUMN share_id TEXT;
CREATE UNIQUE INDEX ux_user_account_share_id ON user_account (share_id);
