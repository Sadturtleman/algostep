# 알고리즘 · Algostep

알고리즘을 학습하고, 문제의 전체 프로그램을 작성해 실행 과정을 확인하는 웹 서비스입니다. 기존 Figma의 로고·컬러·화면 구성으로 구현했습니다.

**현재 상태: 웹·서버·Android 개발 구현. 공개 서비스 출시 완료 상태가 아닙니다.** 47개 학습 주제, P0 인터랙티브 예제, 15개 실행 문제와 3개 언어 추적을 제공하며 외부 계정·도메인·운영 호스트 설정이 필요합니다. 결제는 정책 미정으로 비활성입니다. [지원 범위와 외부 설정](docs/implementation-status.md)을 확인하세요.

## 프로젝트 구조

```text
apps/web       React · TypeScript · Vite · Monaco 웹 클라이언트
apps/server    Fastify API · Google 인증 · PostgreSQL · 비동기 리뷰
apps/runner    Linux KVM · Firecracker jailer · 실행 워커/게스트
apps/android   Kotlin WebView · 네이티브 Google 로그인 · 학습/퀴즈
infra          프록시 · Cloud Run 이미지 · GCP Terraform
docs           ERD · 배포 · 구현 범위
tests          실제 API에 연결하는 브라우저 통합 테스트
```

서버와 웹은 별도 패키지·빌드·컨테이너입니다. 한 저장소에서 버전을 맞추며, 사용자 코드 실행은 별도의 Linux 호스트에서만 허용합니다. 로컬 셸 실행으로 대체하는 모드는 없습니다.

## 로컬 실행

Node.js 24.19 이상이 필요합니다(`.nvmrc` 참고). Windows의 Node 24.12에서는 Vite 빌드가 비정상 종료됐고, 24.19에서 통과했습니다.

```sh
npm ci
cp .env.example .env
npx playwright install chromium
npm run dev
```

Windows PowerShell에서는 `Copy-Item .env.example .env`를 사용합니다. 웹 주소는 `http://localhost:5173`, API는 `http://127.0.0.1:3001`입니다. Google Cloud에서 웹 OAuth 클라이언트를 만들고 허용 JavaScript 출처에 `http://localhost:5173`을 추가한 뒤 `.env`의 `GOOGLE_CLIENT_ID`에 넣으세요. 모든 실제 학습 기능은 Google 로그인이 필요합니다. 인증 우회 개발 계정은 없습니다.

`DATABASE_URL`이 없으면 개발용 PGlite를 `.data/postgres`에 영속 저장합니다. 운영에서는 PostgreSQL 연결과 HTTPS, 강한 세션·워커 비밀키가 필수입니다. `.env`와 DB 데이터는 Git에서 제외됩니다.

VM 워커가 연결되지 않은 실행은 대기 상태입니다. LLM 설정이 없으면 리뷰 버튼은 비활성화되고 과금하지 않습니다. 존재하지 않는 실행 결과나 리뷰를 생성해 보여주지 않습니다.

## 테스트

```sh
npm run check
npm run test:e2e
```

단위·API 테스트는 인증, CSRF, 타인 기록 접근, 자동 저장 충돌, 중복 실행, 리뷰 예약·소비·환불, KST 월초, 기록 100건/30일, 전역 실행 10개 제한을 검증합니다. 브라우저 테스트는 테스트 프로세스에만 주입한 Google 검증기로 실제 API/DB를 사용합니다. 운영 서버에는 해당 검증기가 들어가지 않습니다.

GitHub Actions는 별도 PostgreSQL 17에서도 검사하고 브라우저 스크린샷을 저장합니다. `Isolated VM smoke`는 수동 실행하는 실제 KVM 통합 검사입니다. 테스트용 Google 토큰과 LLM 응답은 외부 서비스 실연동 검증을 대신하지 않습니다.

## 문서

- [ERD 초안](docs/erd-v1.md)
- [현재 물리 모델과 ERD 차이](docs/physical-model.md)
- [API 계약](docs/api.md)
- [배포 및 VM 설정](docs/deployment.md)
- [구현 범위와 남은 작업](docs/implementation-status.md)
- [Android 빌드와 OAuth](docs/android.md)
- [저비용 GCP 구성 검토](docs/gcp-cost-plan.md)
- [마이그레이션·백업·콘텐츠 관리·관측](docs/operations.md)

Monaco는 npm의 workspace 링크 경계 override 문제를 피하기 위해 루트 의존성에 둡니다. DOMPurify 보안 수정 버전을 루트 override로 적용하며 `npm audit`로 확인합니다.

Figma 원본: https://www.figma.com/design/lPDjWigwlNvT2oAjAjxoyx
