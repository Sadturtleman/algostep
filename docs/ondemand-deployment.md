# Algostep 온디맨드 배포

2026-09-19 선택한 구성: GCP `algostep` 프로젝트 하나에 Cloud Run 웹/API, Supabase Free PostgreSQL, N2-standard-2 격리 워커 최대 2대.

배포 주소: https://algostep-90062080967.us-central1.run.app . Cloud Run·Supabase·Scheduler·워커 두 대의 실제 연결 검증은 [검증 기록](verification.md)의 마지막 절을 따른다. 워커는 무료 e2-micro가 아닌 유료 N2이며 유휴 시 중지한다.

## 실행 흐름

1. 웹 실행 요청은 PostgreSQL 영속 큐에 저장한다.
2. 분당 Cloud Scheduler가 인증된 유지보수 엔드포인트를 호출한다. Cloud Run 최소 인스턴스는 0이다.
3. 큐와 실행 중 작업을 보고 워커를 먼저 1대, 필요 시 2대까지 시작한다. 호스트당 2슬롯이므로 실제 동시 실행은 최대 4개다. 서비스 전역 상한 10개는 유지한다.
4. 작업이 없고 실행 중인 제출도 없으면 15분 후 중지한다. 새 요청은 예약 호출 최대 약 1분과 VM 부팅을 기다릴 수 있다.
5. 서버는 작업 배정과 종료 결정을 같은 DB 잠금으로 직렬화한다. 종료할 호스트를 먼저 배정 금지 상태로 저장한 뒤 Compute API에 중지를 요청한다. 불확실한 API 응답은 저장한 requestId로 재시도한다.

## DB와 비밀값

Supabase 프로젝트 `qsrxfuybohxdoqrxrsko`는 Sydney에 있다. IPv4 session pooler 포트 5432와 TLS 인증 검증을 사용한다. Cloud Run 풀은 인스턴스당 최대 5개다. 앱 테이블은 기본 공개 `public` 대신 `algostep` 스키마에 생성하며 Supabase Data API의 노출 스키마에 추가하지 않는다. 미국 API와 Sydney DB 사이 지연 및 전송 비용은 실제 측정 대상이다.

`scripts/save-supabase-secret.ps1`은 사용자가 비밀번호를 숨김 입력하고 연결 문자열을 `algostep-database-url`에 저장한다. 값은 로그·Git에 넣지 않는다. 기본 초기 마이그레이션에는 schema 생성 권한이 필요하다. 운영 DB 역할 분리는 추가 운영 강화 항목이다.

Agent Platform API 키는 `GEMINI_BACKEND=vertex-express`로 연결한다. Gemini Developer API 키와 엔드포인트를 혼용하지 않는다. 모델은 `gemini-3.8-flash`다.

## 이미지와 인프라

- `infra/cloudbuild.yaml`: 서버·웹 통합 컨테이너를 Artifact Registry에 게시한다.
- `infra/gcp/build-worker.sh`: 비밀값 없는 일회성 Ubuntu 빌더에서 SHA256으로 고정한 Linux 6.1.188, Firecracker 1.17.0, 언어 런타임을 만들고 실제 KVM 테스트를 실행한다. 성공 표시와 커널/rootfs 해시를 출력하고 종료한다. 실패해도 종료한다. 성공하지 않은 이미지는 운영에 사용하지 않는다.
- `infra/gcp/workers.tf`: 전용 네트워크, 외부 인바운드 허용 없음, 중첩 가상화 워커 2대, 좁은 IAM 권한. 생성 후 기본 상태는 중지다.
- `infra/gcp/worker-startup.sh`: 기동마다 Secret Manager에서 실행 토큰을 읽어 `/run`의 0600 파일에만 보관한다. 시작 전 운영 이미지 무결성을 검사한다.
- Terraform state, 실제 tfvars, 비밀값은 Git에 올리지 않는다. `enable_workers=true`에는 검증된 GCE 이미지 이름과 두 이미지 해시가 필수다.

## 비용과 운영 경계

무료 VM 2대 구성은 아니다. Supabase Free와 Cloud Run 무료 한도를 활용하되 N2는 가동 시간에 따라 유료다. 디스크 40GiB 두 개는 VM이 꺼져도 과금된다. 동적 외부 IP는 중지하면 해제되며 예약 IP·로드밸런서·Cloud NAT는 만들지 않는다.

비용표는 `cost-report.html`에서 합산 가동 시간과 실행 횟수를 독립적으로 조절한다. 부팅·15분 유휴 대기도 가동 시간에 포함한다. 월 예측은 청구 실적이 아니다. 이미지 보관·빌드·로그 비용과 Supabase 무료 용량 초과 여부를 별도 확인한다.

Compute 제어 또는 Scheduler 장애 동안 유휴 종료가 지연될 수 있다. 알림과 청구 예산은 실제 프로젝트에 추가 설정해야 하며 예산 알림 자체가 강제 지출 상한은 아니다. 자동 시작 후 워커 연결 실패·종료 중 새 요청·DB 장애 복구는 클라우드에서 검증할 배포 체크 항목이다.
