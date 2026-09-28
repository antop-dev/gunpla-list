-- 신규 판매제품 이메일 알림 수신 여부/주소 — 기본은 미동의(0), 메일 주소는 알림 설정 팝업에서 저장하기 전까지 NULL
-- (NULL 이면 UserAccount.email 을 대신 기본값으로 보여준다, NotificationSettingsService 참고)
ALTER TABLE user_account ADD COLUMN notify_on_sale INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_account ADD COLUMN notify_email TEXT;
