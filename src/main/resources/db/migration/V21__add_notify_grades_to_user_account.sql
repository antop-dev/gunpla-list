-- 신규 판매제품 알림을 받을 등급 목록 — 개행으로 합쳐 저장(NewlineSeparatedListConverter)
-- NULL(선택 없음)이면 알림 메일을 보내지 않는다 (기존 수신 동의자 값 채우기는 V22 참고)
ALTER TABLE user_account ADD COLUMN notify_grades TEXT;
