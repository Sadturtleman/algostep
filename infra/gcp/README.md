# Cloud Run / Supabase / 온디맨드 워커

설계와 검증 경계는 [온디맨드 배포](../../docs/ondemand-deployment.md)를 따른다. `secret_ids`는 값이 아니라 기존 Secret 이름만 받는다. Terraform state는 접근을 제한한 저장소에 보관한다.

1. Cloud Run, Cloud Scheduler, IAM, Secret Manager, Storage API를 활성화한다.
2. `infra/Dockerfile.cloudrun`으로 이미지를 빌드해 선택한 Artifact Registry에 게시한다.
3. 필수 Secret과 Google OAuth 설정, 외부 접속 가능한 TLS PostgreSQL을 준비한다.
4. `terraform init`, `terraform fmt -check`, `terraform validate`, `terraform plan`으로 변경과 비용을 검토한다. `web_origin`을 Cloud Run URL로 시작하거나 이미 연결한 도메인으로 설정한다.
5. 승인된 범위의 plan을 apply한다. Cloud Scheduler는 OIDC로 maintenance를 호출하며 비밀 Bearer 키를 스케줄러 설정/상태에 복사하지 않는다.
6. `enable_workers=true`는 N2-standard-2 두 대를 만든다. `worker_image`, `kernel_sha256`, `rootfs_sha256`에 실제 KVM 검증을 통과한 이미지와 해시를 지정한다. 기본 상태는 중지이며, 서버가 수요에 따라 시작하고 15분 유휴 후 중지한다. 30GiB 디스크 두 개는 중지 중에도 과금된다.

필수 TF 변수: project_id, image, web_origin, google_client_id, secret_ids. 기본 region은 us-central1이다. DB는 Supabase IPv4 session pooler와 전용 algostep 스키마를 사용한다. 버킷과 서비스는 파괴 방지 정책을 유지한다. 비밀값·tfvars·state를 Git에 넣지 않는다.
