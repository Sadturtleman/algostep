# MVP 백엔드와 FE 연동 계약

## 범위

`PRODUCT_MODE=mvp`가 기본값이다. `full`은 기존 기능 검증과 롤백용 명시적 설정이다. 잘못된 값은 서버 시작을 실패시킨다. 로그인, 개념/문제 조회, 코드 저장, 공개 테스트 채점, 격리 실행과 추적, 무료 정적 분석을 제공한다.

지원 주제는 `array`, `stack`, `queue`, `binary-search`, `bubble-sort`, `tree`, `bfs`, `dfs`의 8개다. 기존 200개 콘텐츠와 저장 데이터는 삭제하지 않는다. 기존 기록은 소유자가 조회/삭제할 수 있으며 기존 기록의 재실행은 유지한다. 새 기록 생성과 학습 목록은 8개 주제로 한정한다.

관리자, 문의, 비즈니스 이벤트 전송, 리뷰 요청/조회, PDF, Drive, 결제, Android 인증은 MVP 범위 밖이다. 서버는 제외 API를 차단하고 유지보수 작업은 Gemini/GA4/Amplitude에 접속하지 않는다. 기존 외부 키가 설정돼 있어도 기능을 활성화하지 않는다. 기존 분석 전송 큐와 리뷰 데이터는 보존하며 자동 재전송하지 않는다.

상태 예측 판정과 현재 탭 진행 상태는 FE 책임이다. 서버 진도 동기화 API는 제공하지 않는다. 공개 테스트의 입력/기대 출력은 모두 공개하며 실제 Linux 채점은 출력 바이트를 엄격하게 비교한다.

## 실행 방법

Node.js 24.19 이상과 `npm ci`를 사용한다. `.env.example`을 참고해 서버 프로세스 환경에 변수를 주입한다. 서버는 `.env`를 자동 로드하지 않는다.

개발 필수: `PRODUCT_MODE=mvp`, `WEB_ORIGIN=http://localhost:5173`, Google 웹 클라이언트의 `GOOGLE_CLIENT_ID`. 실제 Google 계정 로그인을 사용하며 개발 인증 우회 API는 없다. `DATABASE_URL`을 생략하면 개발용 PGlite가 사용된다. 워커 없는 로컬 실행은 큐에서 대기하며 로컬 셸로 사용자 코드를 실행하지 않는다.

운영 필수: PostgreSQL `DATABASE_URL`, HTTPS `WEB_ORIGIN`, `GOOGLE_CLIENT_ID`, 강한 `SESSION_SECRET`, `RUNNER_TOKEN`, 운영 유지보수용 인증 설정. 추적을 외부화할 때 `TRACE_BUCKET`, Supabase TLS 사용 시 `DATABASE_SSL_CA`를 제공한다. 비밀키를 FE에 전달하지 않는다.

`npm run dev`로 웹/API를 실행한다. Linux KVM 실행 워커 설치·이미지 검증은 기존 `docs/deployment.md`, `docs/ondemand-deployment.md`를 따른다. 워커 프로토콜과 게스트 이미지는 이번 MVP 변경에서 바꾸지 않는다.

기존 마이그레이션은 데이터 보존과 빈 DB 초기화를 위해 유지한다. 이번 변경은 새 스키마 버전을 추가하거나 테이블을 삭제하지 않는다. 서버 기동 시 미적용 마이그레이션만 적용하고 콘텐츠 시드는 기존 게시 내용을 보존한다.

## FE 초기 연결

1. `GET /api/config`를 먼저 읽는다. `productMode`, `features`, `topicIds`, `languages`, `limits`를 사용한다.
2. `POST /api/auth/google`에 `{credential}`을 전달하고 쿠키/CSRF를 받는다. `GET /api/me`로 세션을 복원한다.
3. `/api/topics`, `/api/problems`, `/api/records`를 조회한다. `topics[].id`와 `problems[].topic_id`로 연결한다.
4. 제외된 기능의 API를 호출하지 않는다. `reviewEnabled=false`를 리뷰 서버 장애로 해석하지 않는다. MVP에서는 의도적으로 제외된 기능이다.

`/health`와 `/config` 외 학습 데이터는 로그인 필수다. 변경 요청은 허용 Origin과 `X-CSRF-Token`이 필요하다. 인증 오류는 401, CSRF 오류는 403, 없는/타인 기록은 404로 반환한다. `/api/config`의 `features`는 admin/analytics/reviews/payments/pdf/drive/android/support/predictionSync를 포함한다.

## 코드 저장과 실행

| 요청 | 본문 또는 결과 |
| --- | --- |
| `POST /api/records` | `{problemId, language}`; `language=python/cpp/java` |
| `GET /api/records/:id` | source, language, revision, 최신 execution; MVP reviews는 빈 배열 |
| `PATCH /api/records/:id` | `{source, language, revision}`; 최신 revision 반환 |
| `POST /api/records/:id/executions` | `{requestKey, revision, mode, input?}` |
| `GET /api/executions/:id` | 상태, 테스트별 결과, 추적 |
| `DELETE /api/records/:id` | 영구 삭제; 진행 중 실행의 늦은 결과를 적용하지 않음 |

저장 완료 후 반환된 revision으로 실행한다. 409 `SAVE_CONFLICT`이면 현재 서버 코드를 다시 조회해 사용자 편집과 비교한다. 오래된 편집 내용을 무조건 덮어쓰지 않는다. 네트워크 응답 유실 시 같은 requestKey로 재요청한다. 새 실행 의도일 때만 새 키를 만든다.

`mode=judge`는 모든 공개 테스트 채점, `mode=custom`은 사전 입력 실행이며 정답 판정을 하지 않는다. 상태는 QUEUED/RUNNING/SUCCEEDED/FAILED이다. SUCCEEDED는 처리 완료이고 정답은 별도 verdict로 확인한다. AC/WA/CE/RE/TLE/MLE/OUTPUT_LIMIT을 구분하며 custom 성공은 COMPLETED다. FAILED는 시스템 실패다.

테스트 결과는 input, expected, actual, stderr, verdict, elapsedMs, peakMemoryBytes, trace, traceTruncated를 제공한다. 최상위 결과에는 traceSupport(PYTHON/GDB/JDI/UNSUPPORTED), runnerImage, 필요 시 diagnostics가 있다. 추적 단계는 `{line,event,locals,stack}`이며 line은 실행 직전 위치다. 객체 참조는 `$id`/`$ref`로 연결한다. trace가 비었거나 잘리면 그 상태를 안내하고 프레임을 만들어 채우지 않는다. 채점과 추적은 별도 실행이므로 난수/시각 의존 코드는 결과가 다를 수 있다.

## 제한과 장애 처리

- 소스/사전 입력: UTF-8 각각 64KiB. 단일 파일·표준 라이브러리만 지원.
- 테스트 10초, 사용자 메모리 512MiB, 컴파일 30초, 제출 전체 120초, 출력 64KiB, 추적 최대 2000단계. 초기 제한이며 `/config.limits`를 표시 기준으로 사용한다.
- 서버 전역 최대 10개 임대. 현재 온디맨드 구성은 호스트 최대 2대, 호스트당 2슬롯이므로 실제 호스트 용량은 최대 4개다.
- 기록 100건, 생성 후 30일 보관. 재실행은 같은 기록의 최신 실행을 갱신하며 생성 시각을 연장하지 않는다.
- 워커 임대가 만료되면 유지보수 작업이 RUNNER_INTERRUPTED로 실패 처리한다. 워커가 모두 중지돼도 복구 작업은 동작해야 한다.
- 운영 스케줄러는 `/api/operations/maintenance`를 인증 호출해야 한다. 운영 metrics/ready는 인증된 운영자용이며 관리자 대시보드와 별개다.
- 실행 결과/저장/인증 오류 로그는 유지한다. 사용자 코드와 비밀키를 로그에 추가하지 않는다.

## 검사

`npm run check`는 타입 검사, API/모델/워커 검사, 전체 빌드를 수행한다. 기존 full 모드 검사는 회귀용으로 유지한다. `apps/server/test/mvp.test.ts`는 8개 주제, 제외 API, 저장 충돌/UTF-8 제한, 실행 중복 방지, 소유권, 워커 프로토콜, 임대 회복, 비즈니스 이벤트 미생성을 검증한다. 여기의 워커 결과는 fixture이며 실제 VM 실행을 대체하지 않는다.

`E2E_PRODUCT_MODE=mvp npx playwright test mvp.spec.ts`는 기존 웹의 MVP 호환성을 검사한다. PowerShell에서는 `$env:E2E_PRODUCT_MODE='mvp'`를 설정한 뒤 실행한다. 운영 Google OAuth/실제 VM/외부 저장소는 별도 종단 검증 대상이다.

## 배포와 롤백

빌드 이미지와 `PRODUCT_MODE=mvp`를 함께 배포한다. API·웹의 config 계약이 함께 배포되어야 이전 웹의 리뷰 이용량 조회가 초기 로딩을 막지 않는다. 제외 기능의 키/DB 테이블 삭제는 필요하지 않다. 이전 이미지를 배포해 롤백할 수 있으며 full 재활성화는 보존된 리뷰·분석 대기 작업을 다시 처리할 수 있으므로 의도적으로만 수행한다.
