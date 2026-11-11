-- 사용자 관리(어드민) — 마지막 로그인일시와 차단 여부
-- last_login_at 은 기존 사용자는 알 수 없으므로 NULL 로 두고, 다음 로그인부터 기록된다 (OAuthUserService 참고)
-- 차단된 사용자는 로그인할 수 없고, 이미 로그인된 세션도 다음 요청에서 로그아웃된다 (BlockedUserFilter 참고)
ALTER TABLE user_account ADD COLUMN last_login_at DATETIME;
ALTER TABLE user_account ADD COLUMN blocked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_account ADD COLUMN blocked_at DATETIME;
