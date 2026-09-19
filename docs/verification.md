# 검증 기록

검증일: 2026-09-19. 실제 실행한 검사와 외부 설정 대기를 구분한다.

## 애플리케이션 및 배포 구성

- TypeScript 타입 검사, 웹·서버·워커 production build 통과.
- 단위/API/모델/워커 검사 22개 통과. 로컬 PGlite와 CI PostgreSQL 17을 사용했다. 마이그레이션 반복 적용, Android 일회용 nonce/권한, 객체 저장 무결성·삭제, 정적 분석 판정, P0 모델과 이미지 검증을 포함한다.
- 브라우저 시나리오 9개 통과. 로그인 제한, 테마, 학습·퀴즈, 자동 저장·실행 큐, PDF 다운로드, 워커 결과 연결, 모바일 메뉴 제한, 네트워크/렌더링 전체 화면 CTA, 넓은 화면의 Android 학습 전용 모드, P0 입력 변경과 객체 시각화를 포함한다.
- 390px 모바일 화면을 확인했고 가로 넘침 검사를 통과했다. 편집기는 별도 지연 로드한다.
- 의존성 npm audit: 알려진 취약점 0개. 검사 시점 결과이며 이후 취약점 부재를 보장하지 않는다.
- Android debug APK 조립 및 lint 통과. APK는 CI 아티팩트 algostep-android-debug로 제공한다. 기본 주소는 https://algostep.invalid이므로 실제 운영 도메인으로 다시 빌드해야 한다.
- Terraform 1.9.8 fmt, init -backend=false, validate 통과. Cloud Run용 Chromium 포함 Docker 이미지 빌드 통과. 실제 클라우드 apply는 하지 않았다.

검증 실행:

- [플랫폼 검사 — bc2df7f](https://github.com/Sadturtleman/algostep/actions/runs/35420127118)
- [Android APK 및 lint — 9a57b2e](https://github.com/Sadturtleman/algostep/actions/runs/35418765746)
- [Terraform 및 Cloud Run 이미지 — ad3b8a0](https://github.com/Sadturtleman/algostep/actions/runs/35419902269)

## 실제 격리 VM

- KVM + Firecracker 1.17.0 + jailer에서 15개 문제 × Python 3.10/C++20/Java21, VM 45개와 공개 테스트 111개 AC 및 추적 수집을 확인했다.
- 엄격한 줄바꿈 비교(WA), 런타임 예외(RE), 10초 제한(TLE), 512MiB 제한(MLE), 출력 제한, 외부 네트워크 차단을 확인했다.
- 세 언어에서 사용자 객체의 순환/공유 참조 $id/$ref와 일반 스레드 생성 거부를 확인했다.
- 별도 최신 경계 검사에서 가짜 stdout 파일이 채점을 바꾸지 못하고, 실행 중 수정한 소스가 다음 테스트에 전파되지 않는 것을 확인했다.
- [45개 프로그램 및 기본 경계 검사 — 14c8d5f](https://github.com/Sadturtleman/algostep/actions/runs/35418670059)
- [출력 위조·소스 격리 포함 경계 검사 — a558dea](https://github.com/Sadturtleman/algostep/actions/runs/35419800312)

읽기 전용 rootfs 공유와 권장 코드 줄 분리 후 전체 재검사 중, 게스트 종료와 응답 전달 사이의 연결 종료 오류를 발견했다. 게스트가 호스트의 응답 수신 후 연결 종료까지 기다리도록 수정했다. 수정 후 전체 59개 VM(권장 프로그램 45개, 경계 검사 8개, 객체/스레드 검사 6개)이 통과했다. 권장 프로그램의 공개 테스트 111개가 모두 AC였고 나머지는 각 검사의 기대 판정과 일치했다. 테스트 실행 단계는 약 4분이었다.

- [최종 전체 VM 검사 — 8d7b5ac](https://github.com/Sadturtleman/algostep/actions/runs/35420389720)
- [최종 코드 플랫폼 검사 — 8d7b5ac](https://github.com/Sadturtleman/algostep/actions/runs/35420389450)

VM 스모크 커널: firecracker-ci/20260916-dcfc69b625d0-0/x86_64/vmlinux-6.1.186.
SHA256: ce8be408a5df15d4fc8e73b5483bcbbf91affcf2f0109feedd942a07e7d1547d.
공식 CI의 테스트 이미지이며 프로덕션 승인 이미지는 아니다.

## 검증하지 않은 부분

- 실제 Google 계정 OAuth/Android Credential Manager 로그인, Drive 업로드, GCS 계정 연동, 유료 LLM 호출. 테스트에서는 제공자 경계를 대체했다.
- PG 결제: 정책 미정으로 기능 자체를 비활성화했다.
- 운영 VM 보안 감사, 적대적 프로그램 전체 범위, Java 리플렉션/Unsafe 우회, 장애 복구·부하·비용 측정.
- 모든 사용자 객체의 완전 추적이나 임의 프로그램의 정확한 Big-O 증명.
- Android release 서명·실기기 검수·Play 게시, 클라우드 실배포·도메인·TLS·백업 복원 훈련.

GitHub 업로드와 CI 통과를 운영 출시로 간주하지 않는다. 최신 커밋의 상태는 해당 GitHub Actions 실행을 기준으로 확인한다.

## Gemini 전환 후 추가 검증

2026-09-19: 단위/API 검사 25개, 타입 검사와 전체 빌드 통과. Gemini 헤더 인증, 세 입력만 전달, 구조화 출력, 추론 토큰 분리, 잘린 응답 거부, 성공 소비와 삭제 후 공급자 토큰 원장 보존을 모의 응답으로 확인했다. 실제 Gemini 키 호출과 GCP 배포는 프로젝트/계정 설정 대기다. 비용 계산기의 사용량 변경 및 표/그래프 갱신을 브라우저에서 확인했다. Terraform validate도 통과했다.
# 2026-09-19 온디맨드 인프라 검증

- 커밋 `11c6ac2`: [PostgreSQL·브라우저 CI](https://github.com/Sadturtleman/algostep/actions/runs/35424117201)와 [Terraform·컨테이너 CI](https://github.com/Sadturtleman/algostep/actions/runs/35424117237) 통과.
- 워커 자동 기동/확장/종료 배정 차단/불확실한 종료 재시도, 호스트별 2슬롯, PostgreSQL 전용 스키마를 검증했다.
- GCP Cloud Build `033ec262-dbaf-4d8a-a5ab-6f9184686b50` 성공. Supabase 세션 초기화 개선을 포함한 후속 이미지 빌드는 별도 진행.
- Gemini Vertex Express `gemini-3.8-flash` 실제 최소 호출 HTTP 200, STOP. 키 값은 출력하거나 파일에 기록하지 않았다.
- 운영 이미지 `algostep-worker-20260919`를 실제 GCP N2에서 빌드했다. Linux 6.1.188 / Firecracker 1.17.0에서 59개 VM 검사와 권장 프로그램 공개 테스트 111개가 통과했다. 검증 표시와 해시를 게스트 속성으로 회수한 후 이미지를 생성했다.
- 커널 SHA256: `1d1b7f86cd83b7d293a4449f618ff6092e5cbe5831fc3ec783126bfdb4bf1f2f`, rootfs SHA256: `8791c44332bcf3eb5a580c5185eff9dc1ca596f7daa7056d25d2f45bedc86874`.
- 운영 워커 2대는 Terraform으로 생성 후 `TERMINATED` 상태를 확인했다. 임시 빌더 VM/디스크를 삭제하고 소스 버킷 읽기 권한을 회수했다.
- Supabase 공식 CA를 사용한 실제 TLS 접속, `algostep` 스키마 마이그레이션 버전 4 및 테이블 19개를 확인했다. Gemini 키는 승인된 Secret Manager에 저장했다.
- 로컬 최종 검사 28개 통과, 실제 PostgreSQL용 검사 1개는 CI에서 실행한다. 타입 검사와 전체 빌드 통과. Compute 전송 오류의 인증 헤더가 앱 로그로 전달되지 않는 회귀 검사 포함.
- Cloud Build `8f003900-2a4a-4e15-afd8-7d3ad5954a93` 성공 후 실제 Cloud Run 배포 완료. `/api/health` 200, 익명 `/api/me` 및 운영 준비 요청 401, 인증된 운영 준비·유지보수 200, Scheduler OIDC 호출 200을 확인했다.
- 별도 임시 검증 계정으로 Python/C++/Java 제출을 큐에 넣고 두 호스트 자동 기동 및 세 실행 AC를 확인했다. 제출 06:09:26 UTC, 결과 06:10:59~06:11:10 UTC. GCS 추적 저장 및 앱 조회도 성공했다.
- 실제 Cloud Run의 Gemini 리뷰가 `SUCCEEDED`로 완료됐다. 논리 오류·효율 개선·대안 코드 세 필드가 모두 비어 있지 않았다. 검증용 기록의 PDF 생성은 200/application/pdf, 239,834 bytes 및 `%PDF-` 서명을 확인했다. 이 검사는 임시 DB 세션을 사용했으며 실제 Google 로그인 검증을 대체하지 않는다.
- 활성 실행이 없는 상태에서 검증용 유휴 시각을 16분 전으로 설정해 종료 정책을 실행했다. 두 호스트의 STOP 요청을 확인했다. 실제 15분 연속 대기 시험으로 간주하지 않는다. 임시 계정·기록·리뷰 횟수 원장은 정리하고 추적 삭제를 큐에 넣었으며 실제 Gemini 토큰 사용량 원장은 유지했다.
- 서비스 수준 `min_instance_count=0` 기본값을 명시한 후 Terraform 전체 plan이 `No changes`였다. Cloud Run 이미지/CI와 클라우드 런타임 검증은 별개로 기록한다.
- 실제 Google 로그인은 계정 선택 팝업에서 사용자 진행 대기다. Drive 업로드·Android 운영 로그인·부하/보안 감사는 미완료다. 앞선 절의 외부 설정 대기는 이 후속 기록으로 갱신한다.

## 2026-09-19 P1/P2 학습 확장

- P1 10개·P2 7개 주제의 51개 설명용 예제를 실제 알고리즘으로 계산한다. 17개 주제 전체에서 유효한 노드/간선·독립 프레임·최종 결과를 검사했다.
- 최단 거리/음수 사이클, 위상 정렬, SCC, 최대 유량, 구간 합, KMP, LCA, AVL 균형을 기대 결과와 대조했다. 분할 정복 DP는 완전 탐색 점화식, FFT는 직접 합성곱과 대조했다.
- 로컬 단위/API 검사 34개 통과, 실제 PostgreSQL 전용 1개는 CI에서 실행한다. 타입 검사·전체 빌드 통과. 전체 브라우저 11개 검사 통과(51개 예제 전환, 단계 이동, 모바일 다크/화면 맞춤 포함).
- 기존 P0 코드 제출 문제 15종은 유지하며 이번 51개는 코드 제출 문제가 아닌 학습 시뮬레이션이다.

## 2026-09-19 종류별 학습 및 문제 진입 흐름

- 47개 개념을 9종류로 표시하며 P0/P1/P2를 사용자 UI에서 제외했다. 종류 검색·검색 결과 없음·종류 바로가기를 구현했다.
- 문제 선택 → 기본 개념/예제 좌우 비교 → 이해 확인/문제 풀이 CTA → 편집기 흐름을 검증했다. 개념 화면 진입 전후 기록 개수가 같으며 CTA에서만 기록이 생성된다.
- 모바일 세로 배치·코드 CTA 비노출, 실행 문제 미등록 주제의 다른 문제 안내를 확인했다. 타입/전체 빌드 및 단위/API 34개 통과(실제 PostgreSQL 전용 1개는 CI 대상).
