# API 계약

기본 경로 `/api`. 운영에서는 웹과 같은 HTTPS 출처를 사용한다. 요청/응답은 JSON이며 PDF만 `application/pdf`다.

## 인증과 오류

- `GET /config`: Google 클라이언트 ID, 리뷰/결제 제공 여부. 비밀키 없음.
- `POST /auth/google`: `{credential}` Google ID 토큰을 검증하고 HttpOnly 세션 쿠키와 CSRF 토큰 반환.
- `GET /me`: 로그인 사용자와 CSRF 토큰.
- `POST /auth/logout`: 세션 폐기.
- 인증이 필요한 모든 변경 요청은 허용 `Origin`과 `X-CSRF-Token`을 보낸다.
- 오류: `{code, message}`. 401 로그인 필요, 403 출처/CSRF 오류, 404 소유권 없는 기록 또는 만료, 409 저장 충돌, 402 무료 리뷰 소진, 429 빈도 제한, 503 외부 기능 미연결, 500 시스템 오류.

`/health`와 `/config`를 제외한 학습·풀이 API는 로그인이 필요하다.

## 관리자·비즈니스 지표·문의

- `GET /me`, `POST /auth/google` 사용자 응답에 `isAdmin` 포함. 권한은 서버의 `ADMIN_EMAILS`와 검증된 Google 이메일로 판정한다.
- `POST /analytics/visit`: KST 날짜별 로그인 사용자 방문 등록. 중복 전송 허용, 같은 계정/날짜 한 건만 저장.
- `GET /admin/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD&grain=day|week|month`: 최대 366일, 종료일 포함. 접속/사용자/비용/매출/이벤트/LLM 사용량과 기간별 시계열.
- `GET /admin/users?page=1`, `/admin/events?from=...&to=...&type=...&page=1`, `/admin/costs?from=...&to=...&page=1`: 페이지와 hasMore, 이벤트 타입 필터.
- `POST /admin/costs/import`: `{entries:[{sourceKey,usageDate,service,currency,amount,source}]}`. 최대 500행, KRW/USD, 원본 키별 upsert. `POST /operations/costs/import`는 동일 계약이며 별도 운영 Bearer 토큰만 허용한다.
- `GET /support?page=1&status=OPEN|IN_PROGRESS|RESOLVED`: 본인 문의만 조회.
- `POST /support`: `{requestKey,category,subject,body}`. category=question|bug|billing|other. 제목 120자, 본문 5000자, 계정별 24시간 10건.
- `GET /admin/inquiries?page=1&status=...`: 관리자 전체 문의 조회.
- `PATCH /admin/inquiries/:id`: `{revision,status,reply}`. 답변 5000자, 완료는 답변 필수, 충돌 시 409.

모든 `/admin/*`는 관리자 세션을 요구하며 권한 없는 계정은 403이다. 변경은 동일 출처/CSRF 검증을 적용한다. Android 세션은 방문과 본인 문의를 사용할 수 있지만 관리자 API에는 접근할 수 없다. [상세 운영 정의](admin-dashboard.md).

## 학습 콘텐츠

- `GET /topics`: 학습 설명과 퀴즈 선택지. 정답과 해설은 응시 전 제외.
- `POST /quiz/:topic`: `{answer, requestKey}`. 선택지 인덱스는 0부터 시작. 원래 응답을 재전달하며 중복 저장하지 않는다.
- `GET /problems`: 버전이 고정된 문제·입출력 규격·모든 테스트·언어별 권장 코드/시작 코드.

## 기록과 실행

- `POST /records`: `{problemId, language}`. language는 `python | cpp | java`. 101번째 기록을 만들면 가장 오래된 기록 삭제.
- `GET /records`: 만료되지 않은 내 기록 목록.
- `GET /records/:id`: 최신 코드·revision·실행·리뷰 및 리뷰 당시 코드.
- `PATCH /records/:id`: `{source, language, revision}`. revision 일치 시 갱신하고 증가한 revision 반환.
- `DELETE /records/:id`: 기록 삭제, 진행 중 리뷰 예약 반환, 이미 소비한 이용량은 유지.
- `POST /records/:id/executions`: `{requestKey, revision, mode, input?}`. `mode=judge`는 전체 공개 테스트, `mode=custom`은 입력에 대한 실행이며 정답 판정을 하지 않음.
- `GET /executions/:id`: 상태 및 완료 결과. 테스트별 `input`, `expected`, `actual`, `stderr`, `verdict`, `elapsedMs`, `peakMemoryBytes`, `trace`, `traceTruncated`를 포함.
- `GET /records/:id/pdf`: 한 기록의 전체 PDF. 읽기 전용이며 리뷰 이용량을 소비하지 않음.

실행 상태 `QUEUED → RUNNING → SUCCEEDED/FAILED`. `SUCCEEDED`는 채점 처리가 완료됐다는 뜻이고, 정답 여부는 결과의 `AC/WA/CE/RE/TLE/MLE/OUTPUT_LIMIT`로 구분한다. 사용자 입력 실행 성공은 `COMPLETED`다. `FAILED`는 시스템 오류이며 오답과 구분한다.

채점과 시각화 추적은 같은 입력으로 별도 실행한다. 추적은 디버거 상태이므로 난수·시각 의존 코드 등 비결정적인 프로그램의 채점 실행과 결과가 다를 수 있다. 미지원 값은 설명 문자열로, 미수집 추적은 빈 배열로 표시한다. 수집한 프레임의 `line`은 실행 직전 위치다.

소스 최대 64KiB, 입력 최대 64KiB, 테스트 출력 64KiB, 추적 최대 2000단계/약 60KiB. 초기 제한이며 향후 실험으로 조정한다. 깊은 객체·큰 배열은 일부만 표시하고 분석이 불가능한 코드는 복잡도를 추정하지 않는다.

## 리뷰

- `GET /review-usage`: 무료 부여·예약·소비 수량과 다음 KST 월초 초기화 시각.
- `POST /records/:id/reviews`: `{requestKey, revision}`. 현재 코드에 대한 비동기 리뷰를 생성하고 1건 예약.
- 리뷰 결과는 `GET /records/:id`에서 확인한다. 성공 시 `logicalErrors`, `efficiencyImprovements`, `alternativeCode`를 반환한다.
- 네트워크 오류로 응답을 못 받았다면 같은 requestKey로 재확인한다. 새 리뷰를 의도할 때만 새 키를 사용한다.
- LLM 결과 생성 실패·취소는 예약 반환. 성공 결과 재열람은 추가 소비 없음. 결제 API는 아직 제공하지 않음.

## 실행 워커 전용

외부 프록시에서 `/api/internal`을 차단하고 사설 경로에서 `Authorization: Bearer <RUNNER_TOKEN>`으로 접근한다.

- `POST /internal/claim`: 전역 슬롯을 예약하고 실행 작업을 하나 가져온다. 없으면 `{job:null}`.
- `POST /internal/executions/:id/heartbeat`: `{token}` 임대 갱신. 취소/만료/삭제되면 `active:false`.
- `POST /internal/executions/:id/result`: `{token, result}` 또는 `{token, systemError}`. 유효 임대에만 결과를 반영하며 중복/늦은 결과는 `accepted:false`.

VM 게스트에는 사용자 코드·테스트·제한 값만 전달한다. 서버 API 토큰, Google 세션, LLM 키는 전달하지 않는다.
# 추가 운영·Android 계약

- POST `/api/auth/challenge`: 허용 Origin에서만 5분 일회용 nonce 발급, HttpOnly 쿠키 연결.
- POST `/api/auth/google`: `client: "android"`이면 토큰 nonce·쿠키·DB challenge를 검증/소비하고 학습 전용 세션을 만든다.
- Android 세션은 `/me`, `/topics`, `/quiz/:topic`, `/auth/logout`만 허용한다. `/config`와 `/health`는 공개 설정/상태다.
- `/api/operations/ready`, `/metrics`는 별도 OPERATIONS_TOKEN으로 보호한다. `/maintenance`는 이 토큰 또는 지정된 Google 스케줄러 계정의 OIDC 토큰으로 호출한다.
- 기록/실행 조회는 소유권 확인 후 GCS 추적을 복원한다. 비공개 객체의 공개 URL을 반환하지 않는다.
- PDF 동시 생성 상한은 429/PDF_BUSY, 데이터 16MiB 초과는 422/PDF_TOO_LARGE. 둘 다 기록을 삭제하거나 이용량을 차감하지 않는다.
