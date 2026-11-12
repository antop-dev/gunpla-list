-- 보유 개수 — 보유(owned=1)면 1개부터 시작하고, 미보유면 항상 0
-- 기존 보유 데이터는 1개로 맞춘다
ALTER TABLE user_product ADD COLUMN owned_count INTEGER NOT NULL DEFAULT 0;
UPDATE user_product SET owned_count = 1 WHERE owned = 1;
