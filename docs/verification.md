# 검증 기록

검증일: 2026-09-18

## 실행한 검사

- TypeScript 타입 검사: 통과.
- 서버/워커 테스트 13개: 통과. 로컬 PGlite와 GitHub PostgreSQL 17에서 검증.
- 브라우저 시나리오 5개: 통과. 로그인 제한, 테마, 학습·퀴즈, 그래프/트리, 자동 저장·실행 큐, 모바일 메뉴 제한, 전체 화면 네트워크 오류. 로컬 최신 검사에는 실제 PDF 다운로드도 포함.
- 웹·서버·워커 production build: Node 24.19에서 통과. 웹 초기 JavaScript 약 260kB(압축 약 82kB), Monaco는 편집 화면에서 별도 로드.
- Python 게스트 코드 및 커널 다운로드 스크립트 구문 검사: 통과.
- 실제 KVM + Firecracker 1.17.0 + jailer: 문제 3개 × 언어 3개 = VM 9개, 공개 테스트 총 21개 모두 AC. Python 추적은 모든 첫 테스트에서 수집됨.
- 스크린샷 확인: 웹 편집, 그래프 학습, 390px 모바일 학습 화면을 확인. 브라우저 테스트에서 모바일 가로 넘침 없음.

GitHub 첫 검증:

- [PostgreSQL·빌드·브라우저 검사](https://github.com/Sadturtleman/algostep/actions/runs/35354147382)
- [실제 격리 VM 검사](https://github.com/Sadturtleman/algostep/actions/runs/35354167956)

VM 스모크 커널: `firecracker-ci/20260916-dcfc69b625d0-0/x86_64/vmlinux-6.1.186`.
SHA256: `ce8be408a5df15d4fc8e73b5483bcbbf91affcf2f0109feedd942a07e7d1547d`.
이 커널은 공식 CI의 테스트 이미지이며 프로덕션 승인 이미지가 아니다.

## 검증하지 않은 부분

- 실제 Google 계정 OAuth 로그인/Drive 업로드, 유료 LLM 호출, PG 결제.
- 운영 VM의 보안 감사, 적대적 프로그램 전체 범위, 장애 복구/부하·비용 테스트.
- C++/Java 변수·라인 추적, 사용자 단일 스레드 완전 강제, Android APK.
- 클라우드 실배포·도메인·TLS. GitHub 업로드와 CI 통과는 운영 출시와 다르다.

최신 커밋 결과는 GitHub Actions의 해당 커밋 실행을 기준으로 확인한다.
