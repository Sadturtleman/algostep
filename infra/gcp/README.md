# 준비된 Cloud Run/GCS 구성

아직 apply하지 않았다. 프로젝트·청구 계정·API 활성화·PostgreSQL·도메인·컨테이너 이미지·Secret Manager 비밀값이 선행 조건이다. `secret_ids`는 값이 아니라 기존 Secret 이름만 받는다. Terraform state도 접근을 제한한 원격 저장소에 보관한다.

1. Cloud Run, Cloud Scheduler, IAM, Secret Manager, Storage API를 활성화한다.
2. `infra/Dockerfile.cloudrun`으로 이미지를 빌드해 선택한 Artifact Registry에 게시한다.
3. 필수 Secret과 Google OAuth 설정, 외부 접속 가능한 TLS PostgreSQL을 준비한다.
4. `terraform init`, `terraform fmt -check`, `terraform validate`, `terraform plan`으로 변경과 비용을 검토한다. `web_origin`을 Cloud Run URL로 시작하거나 이미 연결한 도메인으로 설정한다.
5. 사용자 승인 후에만 apply한다. Cloud Scheduler는 OIDC로 maintenance를 호출하며 비밀 Bearer 키를 스케줄러 설정/상태에 복사하지 않는다.
6. 별도의 KVM 러너 호스트를 준비한다. 이 Terraform은 Compute Engine/Cloud SQL을 만들지 않으며 고정비가 큰 두 항목은 비용 선택 후 추가한다.

필수 TF 변수: project_id, image, web_origin, google_client_id, secret_ids. 기본 region은 서울이며 데이터 위치·가격을 검토해 바꿀 수 있다. 버킷과 서비스는 파괴 방지 정책을 유지한다. 비밀값·tfvars·state를 Git에 넣지 않는다.
