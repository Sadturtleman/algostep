# 운영 절차

## 업데이트와 데이터

서버 시작 시 `schema_migrations`를 잠그고 미적용 버전만 트랜잭션으로 적용한다. 버전 1의 기존 데이터도 보존한다. 배포된 마이그레이션을 수정하지 않고 새 버전을 추가한다. 하위 호환되지 않는 변경은 expand → 데이터 이전 → contract로 분리한다. 운영 배포 전 별도 DB에서 복원·마이그레이션을 확인한다.

`DATABASE_URL`을 제공한 운영자만 `node --import tsx apps/server/src/content-admin.ts catalog.json`으로 검증하고 `--publish`로 게시한다. 문제는 새 ID/버전으로 추가하며 기존 권장 코드·테스트는 덮어쓰지 않는다. 설명/퀴즈 갱신 후에도 응시 당시 스냅샷은 유지한다. 게시된 ID 목록은 audit_events에 남고 코드·토큰은 감사 로그에 넣지 않는다. 게시 전에 권장 코드를 3개 언어의 실제 VM에서 검증한다.

## 백업과 복원

- 관리형 PostgreSQL이면 자동 백업/PITR을 활성화하고 보관 기간·비용을 결정한다.
- 자체 운영이면 `pg_dump --format=custom --file=backup.dump "$DATABASE_URL"`로 암호화된 별도 저장소에 백업한다. 비밀번호는 명령 인수가 아닌 제한된 환경/pgpass를 사용한다.
- 빈 검증 DB에 `pg_restore --no-owner --no-privileges --dbname="$RESTORE_DATABASE_URL" backup.dump`를 수행한다. 운영 DB를 덮어쓰지 않는다.
- 복원된 환경은 외부 접근을 차단하고 서버의 만료 정리 실행 후 확인한다. 삭제 요청 이후 백업을 복원하면 삭제된 데이터가 되살아날 수 있으므로 삭제 목록 재적용 및 백업 만료 정책을 운영 전에 확정한다. 현재 사용자 화면에서는 삭제 복구를 제공하지 않는다.
- 월 1회 실제 복원 연습, 레코드/리뷰 원장/마이그레이션 버전과 무결성 확인. RPO/RTO는 인프라 결정 후 측정한다.

## 관측과 서버리스 작업

`OPERATIONS_TOKEN`은 `RUNNER_TOKEN`과 다른 32바이트 이상 비밀값이다. 운영 경로는 Bearer 토큰을 요구하며 사용자·러너 토큰으로 접근할 수 없다.

maintenance에 한해 Google OIDC도 허용한다. `SCHEDULER_AUDIENCE`와 `SCHEDULER_EMAIL`을 설정하고 서명·audience·검증된 이메일의 정확한 일치를 확인한다. Terraform은 전용 스케줄러 계정으로 이 경로를 호출하며 ready/metrics 권한은 부여하지 않는다.

- GET `/api/operations/ready`: DB 연결 확인
- GET `/api/operations/metrics`: 실행/리뷰 상태별 수, 가장 오래된 생성 시각, 삭제 대기 객체 수, 스키마 버전
- POST `/api/operations/maintenance`: 만료 데이터/세션/nonce 정리, 중단 리뷰 회수, 객체 삭제 재시도, 리뷰 1건 처리. 응답 제한 시간 180초 권장.

항상 실행되는 서버는 기본 2.5초 루프를 사용한다. 요청 기반 Cloud Run은 `BACKGROUND_WORKER=false`를 설정하고 외부 스케줄러가 maintenance를 호출해야 한다. 호출 빈도에 따라 리뷰 대기 시간이 달라진다. 여러 요청이 동시에 와도 리뷰 claim은 DB 잠금으로 분리한다. 운영 스케줄러 미연결 상태를 출시 상태로 간주하지 않는다.

5xx 비율, 90초 이상 RUNNING 임대, QUEUED 최장 대기, 삭제 재시도 누적, DB 연결/디스크, VM 호스트 RAM/디스크를 모니터링한다. 큐 경보 기준과 한도는 부하 시험으로 확정한다. 로그에 요청 본문·Authorization·Cookie·LLM 키·사용자 코드를 추가하지 않는다.

## 추적 스토리지와 PDF

`TRACE_BUCKET`이 있으면 추적은 gzip 및 SHA-256으로 GCS에 저장하고 DB에는 비공개 객체 참조를 남긴다. 읽기는 기록 소유권 확인 후 서버가 수행하며 공개 URL을 반환하지 않는다. ADC/Workload Identity를 사용하고 JSON 서비스 계정 키를 VM 게스트에 넣지 않는다. 버킷은 public access prevention, uniform access, 버전 관리/soft delete 비활성, 30일 lifecycle 삭제를 설정한다. 즉시 삭제는 DB outbox → maintenance로 재시도한다. 이미 삭제된 객체의 재삭제도 성공으로 처리한다. 실패한 업로드의 고아 객체는 lifecycle로 제거한다.

PDF는 코드·리뷰·입출력을 조용히 생략하지 않는다. 실행 시각화는 테스트별 처음/중간/마지막 표본이다. 입력 데이터 16MiB 초과는 명시적으로 실패하고 기록을 유지한다. 인스턴스당 동시 PDF 2개, 대기 대신 재시도 응답을 반환한다. 이 한도는 부하 시험 시작값이다. 매우 큰 기록을 모두 PDF로 내보내는 비동기 분할/병합 작업은 별도 확장이 필요하다.
