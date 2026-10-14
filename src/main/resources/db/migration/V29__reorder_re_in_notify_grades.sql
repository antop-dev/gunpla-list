-- 등급 순서를 HG → RE → RG → MG → MGSD → MGEX → PG 로 바꾸면서, 이전 순서(RE 가 맨 뒤)로 저장된 값을 새 순서로 맞춘다
-- (V28 이나 이전 버전 화면에서 저장된 RE 는 항상 맨 뒤에 붙어 있다)
-- 맨 뒤의 RE 를 떼어낸 뒤 HG 가 있으면 HG 바로 다음에, 없으면 맨 앞에 넣는다
UPDATE user_account
SET notify_grades =
    CASE
        WHEN substr(notify_grades, 1, length(notify_grades) - 3) = 'HG'
            THEN 'HG' || char(10) || 'RE'
        WHEN substr(notify_grades, 1, 3) = 'HG' || char(10)
            THEN 'HG' || char(10) || 'RE' || char(10) || substr(notify_grades, 4, length(notify_grades) - 6)
        ELSE 'RE' || char(10) || substr(notify_grades, 1, length(notify_grades) - 3)
    END
WHERE notify_grades LIKE '%' || char(10) || 'RE';
