-- RE 등급이 새로 추가되기 전까지의 전체 등급(HG/RG/MG/MGSD/MGEX/PG)을 모두 고른 사용자는
-- 전부 받겠다는 의도로 보고 RE 도 이어 붙인다
-- (NotificationSettingsService 가 항상 등급 목록 순서대로 저장하므로 정확히 일치하는 값만 비교하면 된다)
UPDATE user_account
SET notify_grades = notify_grades || char(10) || 'RE'
WHERE notify_grades = 'HG' || char(10) || 'RG' || char(10) || 'MG' || char(10) || 'MGSD' || char(10) || 'MGEX' || char(10) || 'PG';
