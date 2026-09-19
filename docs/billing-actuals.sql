-- GCP 표준 사용량 비용 내보내기 테이블로 교체한다. 쿼리 실행도 BigQuery 과금 대상이다.
-- 지역 및 데이터셋 이름은 선택한 Billing export 설정과 일치해야 한다.
SELECT DATE(usage_start_time, 'Asia/Seoul') AS usage_date_kst,
       service.description AS service, currency,
       SUM(cost) AS gross_cost,
       SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)) AS credits,
       SUM(cost + IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)) AS net_cost
FROM `BILLING_PROJECT.DATASET.gcp_billing_export_v1_ACCOUNT_ID`
WHERE project.id = @project_id
  AND usage_start_time >= TIMESTAMP(@start_date, 'Asia/Seoul')
  AND usage_start_time < TIMESTAMP(@end_date, 'Asia/Seoul')
GROUP BY usage_date_kst, service, currency
ORDER BY usage_date_kst, service;
-- 결제 조정/세금/프로젝트 미지정 비용 및 Gemini 별도 청구는 별도 대조한다.
-- end_date는 제외 경계이며, 다른 통화 행을 더하지 않는다.
