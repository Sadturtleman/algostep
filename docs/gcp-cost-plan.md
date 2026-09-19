# 저비용 배포안 — 미배포

서버리스와 GCP는 양자택일이 아니다. GCP Cloud Run이 서버리스 API 후보이며, Firecracker는 Linux KVM 호스트를 별도로 필요로 한다. 계정·지역·예상 트래픽·도메인이 미정이므로 월 비용 숫자를 확정하지 않는다. 2026-09-19 공식 자료를 기준으로 아래 구성을 준비했다.

## 권장 시작 구성

- 웹과 API를 `infra/Dockerfile.cloudrun` 이미지 하나로 제공. Cloud Run 요청 기반 과금, min instances=0, max instances=2부터 측정. 같은 출처로 쿠키/CSRF/Google OAuth를 단순화한다. PDF 브라우저 메모리 때문에 인스턴스 메모리 1–2GiB를 부하 시험한다.
- PostgreSQL 영속 DB. Cloud SQL은 운영 부담을 줄이지만 고정 비용을 따로 계산한다. 가장 싼 VM에 DB를 직접 운영하는 선택은 백업·복원·장애 대응 비용을 사용자가 맡는다는 전제다. 서버리스 인스턴스의 임시 파일에 PGlite를 운영 DB로 두지 않는다.
- GCS private bucket에 압축 추적. 30일 lifecycle, 공개 접근 차단, 필요 없는 버전/soft-delete 보관 비용 제거. 앱이 outbox 삭제를 별도 처리한다.
- Firecracker는 nested virtualization이 가능한 Intel N2 등 Compute Engine 호스트에서 실행. **E2는 중첩 가상화를 지원하지 않으므로 저가 E2 호스트에 Firecracker를 배치하지 않는다.** Linux/KVM 확인과 VM 스모크 테스트를 먼저 수행한다.
- 전역 동시 실행 상한 10은 DB에서 유지한다. 호스트 슬롯을 2로 시작하면 비용/메모리를 줄이는 대신 나머지는 대기한다. 실제 10개를 동시에 수용하려면 VM 메모리만 약 7.5GiB이며 호스트·페이지 캐시·워커 여유를 추가해야 한다. 슬롯을 늘리기 전 부하 시험이 필요하다.
- API의 요청 기반 CPU에서는 백그라운드 타이머를 신뢰하지 않는다. `BACKGROUND_WORKER=false`, 외부 스케줄러의 `/api/operations/maintenance` 호출을 연결한다. 비용과 리뷰 지연을 보고 호출 주기를 결정한다.

## 비용을 줄이는 순서

1. 소규모 비공개 테스트는 기존 KVM 장비가 있다면 사용하고, API/DB의 실제 사용량부터 측정한다.
2. VM 워커가 가장 큰 고정비 후보다. 항상 켜둘지 정해진 시간에만 운영할지 먼저 결정한다. 종료 시 실행 임대를 안전하게 정리해야 한다. 현재 자동 start/stop 오케스트레이터는 제공하지 않는다.
3. Cloud Run minimum instances 0, 로그 보관 기간 제한, 압축 추적 30일, 불필요한 로드밸런서/NAT/다중 리전 제거로 시작한다.
4. 비용 알림은 지출을 차단하지 않는다. VM 수·Cloud Run max instances·리뷰 사용량·요청 제한을 함께 적용한다.
5. DB 자체 운영 대 관리형, 사용 시간, 지역, 아웃바운드 트래픽을 넣고 공식 계산기로 비교한 뒤 배포한다. 무료 한도만으로 서비스 전체가 무료라고 가정하지 않는다.

## 설정 체크

`DATABASE_URL`, `WEB_ORIGIN`, `GOOGLE_CLIENT_ID`, `SESSION_SECRET`, `RUNNER_TOKEN`, `OPERATIONS_TOKEN`은 Secret Manager/환경으로 주입한다. `TRACE_BUCKET`과 서비스 계정의 bucket object 권한을 연결한다. LLM 세 변수는 리뷰 활성화 때만 제공한다. API 런타임과 러너 서비스 계정을 분리하고 게스트에는 어떤 클라우드 자격 증명도 전달하지 않는다. 러너 API에 도달하는 네트워크 경로와 인증을 설정한다.

공식 근거:
- https://cloud.google.com/run/pricing
- https://docs.cloud.google.com/run/docs/configuring/billing-settings
- https://docs.cloud.google.com/compute/docs/instances/nested-virtualization/overview
- https://docs.cloud.google.com/compute/docs/general-purpose-machines
- https://cloud.google.com/sql/pricing

이 문서는 배포 설계이며 클라우드 리소스 생성·요금 발생·도메인 연결을 수행하지 않는다.
