-- 구글 이름과 별개로 사용자가 정하는 닉네임 — 공유 페이지 등에 표시된다
-- NULL 이면 아직 닉네임을 정하지 않은 사용자로, 로그인 후 닉네임 설정 팝업을 띄운다 (user-header.js 참고)
-- 기존 사용자는 구글 이름을 그대로 복사한다
ALTER TABLE user_account ADD COLUMN nickname TEXT;
UPDATE user_account SET nickname = name WHERE name IS NOT NULL AND trim(name) <> '';
