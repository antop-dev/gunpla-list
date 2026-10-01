-- V21 의 notify_grades 컬럼이 생기기 전에 수신 동의한 사용자는 등급 구분 없이 전부 받고 있었으므로
-- 전체 등급으로 채워 그대로 받게 한다
UPDATE user_account
SET notify_grades = 'HG' || char(10) || 'RG' || char(10) || 'MG' || char(10) || 'MGSD' || char(10) || 'MGEX' || char(10) || 'PG'
WHERE notify_on_sale = 1;
