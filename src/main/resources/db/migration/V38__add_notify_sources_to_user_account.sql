-- 신규 판매제품 알림을 받을 출처 목록 — 개행으로 합쳐 저장(NewlineSeparatedListConverter)
-- NULL(선택 없음)이면 알림 메일을 보내지 않는다 (OnSaleNotificationService 참조)
-- 기존 수신 동의자는 출처 구분 없이 전부 받고 있었으므로 모든 출처를 채운다
ALTER TABLE user_account ADD COLUMN notify_sources TEXT;
UPDATE user_account
SET notify_sources = '반다이남코코리아몰' || char(10) || '네이버+ 스토어' || char(10) || 'PREMIUM BANDAI'
WHERE notify_on_sale = 1;
