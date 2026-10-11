-- 공유 URL 을 Shorty 로 단축한 값 — 공유를 허용할 때 만들어 저장한다 (설정을 열 때마다 Shorty 를 호출하지 않도록)
-- NULL 이면(단축 전이거나 Shorty 실패) 원본 공유 URL 을 보여주고, 다음에 공유 설정을 저장할 때 다시 단축을 시도한다
ALTER TABLE user_account ADD COLUMN share_short_url TEXT;
