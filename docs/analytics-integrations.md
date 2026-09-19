# GA4 · Redash 비즈니스 이벤트

## 상태와 데이터 흐름

현재 앱의 36종 비즈니스 이벤트를 공통 원장에 저장한다. 서버 작업은 상태 변경과 같은 트랜잭션에서 `business_events`와 `analytics_deliveries`에 기록한다. UI 상호작용은 인증·CSRF가 적용된 `POST /api/analytics/events`를 통해 같은 원장으로 들어간다. GA4는 이 원장에서 Measurement Protocol로 전송하고 Redash는 조회 전용 PostgreSQL 뷰에서 읽는다.

**외부 활성화에 필요한 값:** GA4 웹 측정 ID, Measurement Protocol API Secret, 사용자의 Redash HTTPS 주소와 관리 API 권한. 설정 전에도 DB 수집은 동작하며 관리자 → 비즈니스 로그에 `연결 설정 대기`로 표시한다. 연결 설정 완료와 외부 보고서 수신 검증은 다르다. 이 문서나 코드의 존재만으로 외부 연결 완료를 뜻하지 않는다.

## 이벤트 목록

GA4 이름은 아래 코드에 소문자 `as_` 접두어를 붙인다. 예: `EXECUTION_FINISHED` → `as_execution_finished`. 정확한 허용 속성과 열거형은 `apps/server/src/event-catalog.ts`가 기준이다.

| 영역 | 이벤트 | 수집 시점 / 속성 |
| --- | --- | --- |
| 계정·방문 | USER_REGISTERED, LOGIN, LOGOUT, DAILY_VISIT | 실제 가입·로그인·로그아웃·KST 날짜별 첫 로그인 방문. client(web/android) |
| 화면·검색 | SCREEN_VIEWED, SEARCH_USED, CATEGORY_SELECTED | 화면/주제 ID, 검색 결과 수, 카테고리 위치. 검색어 제외 |
| 학습 예제 | EXAMPLE_SELECTED, EXAMPLE_APPLIED, VISUALIZATION_CONTROL | 주제·예제 위치, 입력 개수/적용 성공, 단계 이동·재생·배치·노드 이동. 입력값·좌표 제외 |
| 퀴즈 | QUIZ_VIEWED, QUIZ_ANSWERED, QUIZ_RETRIED | 주제·문항 위치·정답 여부. 답안 내용 제외 |
| 코드 작성 | PRACTICE_STARTED, CODE_SAVED, LANGUAGE_SELECTED | 문제 ID·언어·저장 revision. 키 입력별 이벤트 및 소스 코드 제외 |
| 코드 실행 | EXECUTION_REQUESTED, EXECUTION_STARTED, EXECUTION_FINISHED | 문제·언어·실행 모드·시도·상태·판정. 실행 환경 중단 포함 |
| 결과 탐색 | RESULT_TAB_VIEWED, TEST_SELECTED | 시각화/테스트/분석/리뷰 탭, 공개 테스트 위치 |
| LLM 리뷰 | REVIEW_REQUESTED, REVIEW_STARTED, REVIEW_SUCCEEDED, REVIEW_FAILED | 언어·모델·실패 코드. 프롬프트·리뷰 내용 제외 |
| 기록·내보내기 | RECORD_DELETED, PDF_GENERATED, PDF_EXPORTED | 직접 삭제, PDF 생성, 다운로드/Drive 및 성공 여부 |
| 문의·운영 | INQUIRY_CREATED, INQUIRY_UPDATED, COSTS_IMPORTED, CONTENT_PUBLISHED, ADMIN_SECTION_VIEWED | 유형·상태·가져온 행 수·게시 개수·관리 메뉴. 문의 본문/답변 제외 |
| UI 상태·오류 | THEME_CHANGED, CLIENT_ERROR, ERROR_RECOVERY | 테마·안전한 오류 코드·복구 동작. 예외 메시지/스택 제외 |

이벤트 원장은 사용자 행동과 완료된 서버 작업을 구분한다. `PDF_GENERATED`는 서버가 PDF를 만들었다는 뜻이며 사용자의 다운로드 완료를 증명하지 않는다. `PDF_EXPORTED`는 브라우저가 내보내기 동작/Drive 요청을 성공 처리한 상태다. UI 이벤트는 비즈니스 결제·정답 판정의 근거로 사용하지 않는다. PG 결제가 비활성인 상태에서 구매·환불 이벤트를 가짜로 만들지 않는다. 향후 실제 PG 서명 검증 처리에 결제·환불 이벤트를 추가해야 한다. 자동 보관 만료·GC·heartbeat·조회 polling은 사용자 행동 이벤트로 집계하지 않는다.

## 중복·실패·성능

- 서버 이벤트는 고유 작업 키로 원장/전송 큐를 함께 중복 제거한다. UI는 UUID 요청 키를 재사용한다. 서버 이벤트 타입은 클라이언트가 제출할 수 없다.
- UI는 1초 단위, 최대 25건씩 전송한다. 연결 실패 시 최대 30초 간격으로 재시도하고 메모리에 최대 200건만 둔다. 탭 강제 종료·오프라인 장기 지속·메모리 한도에서는 유실될 수 있다. 키 입력·프레임별로 전송하지 않는다.
- 기존 1분 유지보수 스케줄에서 GA4 큐를 처리한다. 사용자/브라우저 컨텍스트별 최대 25건, 호출당 최대 250건 또는 20초 예산이다. 이벤트별 실제 발생 시각을 유지한다. 대량 이용 시 PENDING 추이와 처리 지연을 보고 처리량을 조정한다.
- 전송 전 `/debug/mp/collect` 검증 후 `/mp/collect`로 보낸다. 검증 단계의 네트워크 장애는 최대 5회 재시도한다. 2xx는 `ACCEPTED`(HTTP 수신)이며 GA4 보고서 반영을 증명하지 않는다. 실제 수신 여부가 불명확한 요청/임대 만료는 `UNCERTAIN`으로 격리하고 자동 재전송하지 않는다. 검증 실패는 `REJECTED`, 72시간이 지난 미전송 이벤트는 `EXPIRED`다. 만료되어도 원장은 남는다.
- GA4는 일반 이벤트 ID의 exactly-once 처리를 보장하지 않는다. 정확한 운영 집계는 DB/Redash 원장을 기준으로 한다. 활성화 전 72시간 이상 지난 데이터는 Redash에서만 분석하며 시간을 조작해 GA4에 넣지 않는다.
- 브라우저 GA 태그의 client_id/session_id와 임의 생성한 analytics 사용자 UUID만 전달한다. 태그 차단·Android WebView 등 컨텍스트가 없으면 `server_unattributed`로 구분한다. 이를 정상 웹 세션·체류 시간 지표로 해석하지 않는다. engagement_time을 임의 생성하지 않는다.
- Google 태그 자체의 page_view/first_visit/session_start 등 자동 이벤트는 GA4의 웹 계측이며 36종 앱 이벤트 원장과 별도다. 앱 이벤트를 Google 태그와 서버 양쪽에서 중복 전송하지 않는다.

## GA4 활성화

1. Algostep 전용 GA4 속성과 **웹** 데이터 스트림을 사용한다. 서비스 URL은 `https://algostep-90062080967.us-central1.run.app`이다. 속성 시간대는 Asia/Seoul, 통화는 KRW로 설정한다. 웹뷰는 같은 웹 이벤트 모델을 사용한다.
2. 데이터 스트림에서 **향상된 측정은 끈다**. 검색어·폼·다운로드 URL 등 비허용 자동 수집을 방지하고 명시한 앱 이벤트만 사용한다. Google Signals/광고 개인 최적화는 사용하지 않는다.
3. Measurement Protocol API Secret을 Secret Manager의 전용 Secret에 저장한다. 비밀 값은 채팅/Git/Terraform 변수 파일/로그에 넣지 않는다. `ga4_measurement_id`에 공개 측정 ID를, `secret_ids`의 `GA4_API_SECRET`에 **Secret 이름**만 추가한다. Cloud Run 서비스 계정은 그 Secret 읽기 권한만 갖는다.
4. 배포 후 관리자 연결 상태와 큐 상태를 확인한다. 테스트 환경용 속성 또는 구분 가능한 한 번의 실제 학습 동작으로 검증 응답과 GA4 이벤트 보고서를 대조한다. HTTP 수신만으로 완료 처리하지 않는다.
5. 보고서 필터가 필요하면 이벤트 범위 맞춤 측정기준 `screen`, `topic`, `problem`, `language`, `mode`, `verdict`, `event_source`, `destination`, `section`을 등록한다. `event_id`나 사용자 UUID는 고유값이 많으므로 맞춤 측정기준으로 등록하지 않는다. 기본 통계는 `as_*` 이벤트 이름으로 조회할 수 있다.

코드는 로그인 사용자에 한해 태그를 로드하고 로그아웃하면 추적을 비활성화한다. 전송에 코드·이메일·Google sub·문의 본문·검색어·개별 기록 URL·인증 토큰을 포함하지 않는다. 브라우저 page URL은 서비스 origin으로 고정한다. API Secret은 서버에서만 사용한다.

## Redash 활성화

새 유료 Redash 호스트를 자동 생성하지 않는다. 기존 HTTPS Redash 인스턴스가 필요하다. Redash는 이벤트 수집기가 아니라 읽기 전용 DB 분석 경로다.

1. 마이그레이션 6을 적용한 후, 서비스 소유자 DB 연결·CA·32자 이상 임의 비밀번호를 보안 환경 변수로 전달해 `npx tsx scripts/provision-redash-role.ts`를 실행한다. `DATABASE_URL`, `DATABASE_SSL_CA`, `REDASH_DB_PASSWORD`가 필요하다. 스크립트는 관리 표식이 있는 `algostep_redash` 역할만 만들거나 갱신한다. 기존에 다른 용도로 만든 동명 역할은 변경하지 않는다.
2. 조회 계정은 `algostep.analytics_events`, `analytics_visitors`, `analytics_users`, `analytics_costs`, `analytics_revenue`, `analytics_inquiries`, `analytics_delivery_status` 7개 뷰의 SELECT만 허용한다. 기본 테이블 권한·다른 역할 멤버십이 발견되면 트랜잭션을 롤백한다. 기본 read-only, 15초 문장 제한, 3개 연결 제한을 둔다. 이 계정으로 코드/세션/문의 원문을 읽을 수 없어야 한다.
3. Redash에 제공할 **조회 전용** 연결 URL을 생성해 보안 환경 변수 `REDASH_DATABASE_URL`로 전달한다. Supabase 세션 pooler 사용자명은 `algostep_redash.<project-ref>`를 사용한다. 서비스의 postgres 관리자 URL을 Redash에 넣지 않는다. 해당 프로젝트의 CA로 TLS `verify-full` 검증을 유지한다.
4. `REDASH_URL`, `REDASH_API_KEY`, `REDASH_DATABASE_URL`, `DATABASE_SSL_CA` 환경에서 `node scripts/bootstrap-redash.mjs`를 실행한다. 관리 권한으로 데이터 소스·13개 쿼리·대시보드 위젯을 만들고 각 쿼리를 실제 실행한다. 오류에 비밀 값이나 결과 행을 출력하지 않는다. 기본 위젯은 조회 결과 표다.
5. `tmp/redash-state.json`은 동일 대상에 재실행하기 위한 ID 매핑이다. API 키/비밀번호를 포함하지 않지만 Git에 넣지 않는다. 같은 이름의 기존 데이터 소스에 이 상태 파일 없이 임의 덮어쓰기를 하지 않는다. Redash 사용자/그룹 접근 권한을 관리자에게만 제한하고 공개 대시보드 공유를 켜지 않는다.
6. Cloud Run `redash_url`을 연결한 주소로 설정하면 관리자 화면에 링크가 표시된다. 주소가 존재한다는 사실만으로 데이터 소스 연결/쿼리 실행 성공을 표시하지 않는다.

13개 쿼리는 누적·일·주·월 접속자, 일/주/월 추이, 가입 사용자, 이벤트 목록, 학습 활동별 고유 사용자, 실행 판정, 비용, 매출/환불, 문의 상태, GA4 전달 상태, 최근 이벤트 상세다. 활동별 사용자 수는 순서가 증명된 전환 퍼널이 아니다. KST 기준 월요일 시작 주간 및 달력 월간, 통화별 분리 집계다. 기존 청구 자료 가져오기에 기반하므로 비용 미수집을 0원으로 바꾸지 않는다.

## API / 운영 확인

- `POST /api/analytics/events`: 로그인·CSRF 필수, 배열 1~25건, 경로별 분당 60요청(기본 IP 제한). 허용 타입/필드 외 입력은 전체 배치를 거절한다.
- `GET /api/admin/analytics`: 관리자 전용. 설정 여부, 전송 상태 건수, 안전한 Redash 주소, 이벤트 카탈로그. API Secret을 반환하지 않는다.
- 현재 원장/전송 상태는 별도 자동 삭제 정책 없이 보관한다. Supabase 용량은 지속 관찰하고 보관 기간을 결정한 후 원장 아카이브/삭제를 적용해야 한다. 학습 기록 30일 보관 정책을 비즈니스 원장에 자동 적용하지 않는다.

참고: [GA4 전송 및 제한](https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events), [GA4 검증](https://developers.google.com/analytics/devguides/collection/protocol/ga4/validating-events), [Redash API](https://redash.io/help/user-guide/integrations-and-api/api/).
