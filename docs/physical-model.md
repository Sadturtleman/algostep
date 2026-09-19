# 현재 물리 모델

ERD v1은 목표 논리 모델이다. 현재 구현은 PostgreSQL JSONB와 정규화한 16개 애플리케이션/운영 테이블 및 schema_migrations를 사용한다. ERD 24개 전체의 일대일 구현이라고 간주하지 않는다.

- 문제 ID에 버전을 포함한다(`binary-search-v1`). 문제·테스트·3개 언어의 권장 코드는 게시 후 업데이트하지 않는 하나의 불변 행이며 테스트와 권장 코드는 JSONB다. 개정 시 새 ID를 발행한다.
- topics에 학습 설명과 퀴즈를 묶는다. 퀴즈 응시는 문항·정답·해설 스냅샷을 보존한다.
- records → code_snapshots → executions/reviews는 정규화하고 복합 FK로 같은 기록의 코드만 연결하도록 강제한다.
- 테스트별 출력·측정치·분석은 result JSONB다. TRACE_BUCKET 설정 시 추적은 GCS gzip 객체와 체크섬 참조로 분리한다. object_deletions는 기록 삭제/만료 후 재시도 가능한 삭제 outbox다. 소스/입력은 65,536문자, 개별 출력 64KiB, 결과 요청 2MiB 등으로 제한한다.
- reviews, review_allowances, review_credit_events는 별도 테이블이다. 예약/소비/반환은 원장과 카운터를 같은 트랜잭션으로 갱신한다. 삭제 시 원장에는 콘텐츠 없이 소비 이력을 남긴다.
- sessions는 불투명 세션 토큰의 해시와 CSRF 토큰, 만료를 저장한다. 실행 전역 슬롯은 execution_control 단일 행 잠금과 임대로 관리한다.
- 실행 테이블 자체를 작업 큐로 사용한다. API 트랜잭션 커밋 후 워커가 `FOR UPDATE SKIP LOCKED`로 가져가므로 외부 큐 전달 실패 문제가 없다. 관리형 큐로 이전할 때 outbox를 추가한다.
- PDF는 요청 시 생성하며 영구 저장하지 않는다. Drive는 사용자가 명시적으로 요청할 때 브라우저의 단기 OAuth 토큰으로 업로드한다.
- PG 주문·결제·유료 이용권은 상품 조건과 공급자가 결정되지 않아 구현하지 않았다. 결제 버튼이나 가짜 결제 성공 응답도 제공하지 않는다.

- auth_challenges는 Android 로그인 nonce 해시/5분 만료를 저장한다. sessions.client로 학습 전용 권한을 분리한다.
- audit_events는 콘텐츠 게시 등 운영 이벤트의 대상 ID를 보관하며 사용자 코드/비밀값을 저장하지 않는다.
- review_api_usage는 제공자·모델·입력/출력/추론 토큰·시각을 저장한다. 사용자 ID·코드·프롬프트 없이 공급자 비용 대조에 사용하며 기록 삭제로 사라지지 않는다.
- problems.complexity_time/space는 권장 코드의 전체 프로그램 비용이다. 기존 문제는 topics.complexity를 호환용으로 사용한다.

초기 스키마: `apps/server/src/schema.ts`; 버전별 적용: `apps/server/src/migrations.ts`. 운영 DB 권한 분리·실제 백업/복원·경보 설정은 인프라 구성에 포함한다.
