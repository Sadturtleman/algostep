# Gemini 및 배포 진행 상태 (2026-09-19)

Gemini Developer API의 `gemini-3.8-flash`를 기본 리뷰 모델로 연결했다. `GEMINI_API_KEY`가 있을 때 활성화하며 모델 ID는 `GEMINI_MODEL`로 바꿀 수 있다. Google의 generateContent 엔드포인트에 키를 헤더로 보내고, low thinking과 최대 출력 8,192 토큰을 사용한다. 정해진 세 입력만 전달하며 JSON 스키마와 서버 검증을 모두 적용한다. MAX_TOKENS/차단/비정상 출력은 성공 처리하지 않고 사용자 이용량 예약을 반환한다.

응답의 입력·출력·추론 토큰은 개인정보 없는 `review_api_usage`에 기록한다. 실패한 출력도 제공자가 보고한 사용량이 있으면 기록한다. HTTP 오류/응답 유실/DB 기록 실패의 실제 제공자 과금은 앱 원장으로 완전히 복원할 수 없으므로 Gemini 사용량 화면과 대조해야 한다. 운영 metrics는 최근 30일의 모델별 사용량을 제공한다. `output_tokens`와 `thinking_tokens`를 합쳐 Gemini 출력 과금을 계산한다. 사용자 기록 삭제와 공급자 비용 원장은 별개다.

## 배포 상태

클라우드 배포는 사용자 요청으로 진행 대상이다. 현재는 GCP 프로젝트 선택, 월 예산, Google OAuth 클라이언트, DB, Secret 설정이 미완료이므로 배포하지 않았다. 브라우저에서 확인된 RuleUp 프로젝트는 다른 서비스이므로 임의 배포 대상으로 사용하지 않았다. 로컬 gcloud/ADC도 연결되지 않았다. 앱 코드 및 Terraform 검증은 실제 계정 연동 검증을 대신하지 않는다.

1. 배포할 프로젝트와 지역을 정하고 결제 연결 및 API 권한을 확인한다.
2. PostgreSQL, Google OAuth, Secret Manager의 DATABASE_URL/SESSION_SECRET/RUNNER_TOKEN/OPERATIONS_TOKEN/GEMINI_API_KEY를 준비한다.
3. Cloud Run 이미지 게시, Terraform plan/apply, OAuth 허용 출처 등록을 진행한다. 키는 채팅·Git·tfvars 값에 넣지 않는다.
4. 별도 KVM 호스트를 연결하고 실제 로그인·세 언어 실행·Gemini 리뷰·PDF·Drive를 확인한다.
5. Billing의 BigQuery 내보내기를 켜고 실제 비용을 수집한다. 내보내기 이전 사용량은 소급 범위에 제한이 있을 수 있다.

## 비용표와 그래프

[인터랙티브 비용 계산기](cost-report.html)는 실행 수, 리뷰 비율, 토큰 수, 환율 가정 및 2027년 요금 변경을 조정할 수 있다. 계산 원본은 `scripts/cost-model.mjs`이며 `node scripts/cost-model.mjs --json`으로 재현한다.

Iowa 공식 기준 단가와 명시한 계획 가정을 혼합한 예산 시뮬레이션이다. 현재 Terraform 기본 서울 리전의 확정 견적이 아니다. N2 호스트는 사용량이 없어도 비용이 발생하며 무료 리뷰도 운영자는 API 요금을 부담한다. DB $20, 기타 $3은 제품 확정 전의 예산 항목이다. 실제 SKU 선정 후 바꿔야 한다. 2026년 Gemini 프로모션 종료 시 단가가 두 배가 되므로 선택 항목으로 분리했다. 할인·무료 한도·세금은 차감/가산하지 않았다.

VM 워커의 빈 큐 확인 간격은 1.5초에서 점차 15초까지 늘어난다. 작업을 받으면 초기 간격으로 돌아간다. 지속적인 빈 큐 조회 비용을 줄이는 대신 오래 유휴 상태였던 실행은 최대 약 15초의 추가 대기가 생길 수 있다. 서버 전역 10개 임대 제한은 유지한다.

현재 표의 수치는 청구서가 아니다. 실배포 후 같은 기간의 Billing 비용, Gemini 토큰, 실행/리뷰 건수와 요청별 실제 과금 시간을 대응시켜 갱신해야 한다.
