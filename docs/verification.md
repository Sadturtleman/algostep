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
