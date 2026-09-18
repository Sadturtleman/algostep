# 실행 및 배포

## 서버·웹

1. Node 24와 npm 의존성을 설치하고 `.env.example`을 `.env`로 복사한다.
2. Google OAuth 웹 클라이언트의 허용 출처를 설정하고 `GOOGLE_CLIENT_ID`를 넣는다. 로그인용 ID 토큰과 Drive용 액세스 토큰은 분리한다.
3. `SESSION_SECRET`, `RUNNER_TOKEN`은 서로 다른 32자 이상의 난수로 설정한다. 저장소·로그·클라이언트 번들에 넣지 않는다.
4. 운영은 `DATABASE_URL`, HTTPS `WEB_ORIGIN`, `NODE_ENV=production`을 사용한다. 초기 스키마 적용 계정과 운영 DB 계정은 배포 시 분리하는 것이 필요하다.
5. `npm run build`; API는 `npm start -w apps/server`, 웹은 `apps/web/dist`를 정적 호스팅한다. `/api`는 같은 출처의 API로 프록시한다.
6. PDF는 `npx playwright install --with-deps chromium`과 한국어 폰트가 필요하다. `PDF_BROWSER_PATH`로 설치 브라우저 경로도 지정할 수 있다.

`compose.yaml`은 PostgreSQL/API/nginx 컨테이너 예시다. `.env`에 `POSTGRES_PASSWORD`를 추가하고 외부 TLS 프록시에서 `localhost:8080`으로 전달한다. 공개 API 프록시는 `/api/internal`을 차단한다. VM 워커는 사설 API 주소를 사용한다. Compose에 VM 워커를 일반 컨테이너로 넣지 않는다.

현재 API 프로세스는 리뷰/만료 작업을 함께 폴링한다. 완전한 서버리스 함수 배포를 완료한 구성이 아니다. 서버리스로 옮길 때 API 어댑터와 별도 예약/리뷰 워커를 배치하고 연결 풀/비밀키/동시성을 구성해야 한다.

## Linux VM 호스트

Firecracker 1.17.0과 같은 릴리스의 jailer를 사용한다. `/dev/kvm`, Linux cgroup v2, ext4, virtio-vsock 지원 커널이 필요하다. 외부 네트워크 인터페이스를 게스트에 부착하지 않는다.

```sh
bash apps/runner/build-rootfs.sh
# 검증한 production kernel과 rootfs를 /opt/algostep에 배치
export KERNEL_PATH=/opt/algostep/vmlinux
export ROOTFS_PATH=/opt/algostep/rootfs.ext4
export FIRECRACKER_BIN=/usr/local/bin/firecracker
export JAILER_BIN=/usr/local/bin/jailer
export RUNNER_WORKDIR=/var/lib/algostep
export API_URL=https://private-api.example.com
export RUNNER_TOKEN='use-your-secret-manager'
export RUNNER_SLOTS=2
npm start -w apps/runner
```

Jailer 초기화에는 호스트 권한이 필요하므로 전용 격리 호스트에서 서비스 관리자로 실행한다. 게스트 Firecracker는 지정 UID/GID(기본 1001)로 권한을 낮춘다. API·DB·LLM·Google 비밀값을 게스트에 넘기지 않는다. 코드와 공개 테스트만 vsock으로 보낸다.

한 VM에는 제출 하나를 배정하고 끝나면 폐기한다. 호스트별 RUNNER_SLOTS와 별개로 DB에서 전체 10개 제한을 적용한다. heartbeat 확인이 60초 이상 끊기면 워커는 실행을 중단한다. 서버 임대 만료는 90초다. 호스트 프로세스 자체가 정지하는 장애까지 다루려면 외부 watchdog 및 fencing 검증이 추가로 필요하다.

`scripts/download-test-kernel.py`는 공식 Firecracker CI의 **테스트용** 이미지만 받는다. 다운로드 URL과 SHA256을 출력하며 운영 이미지로 자동 승격하지 않는다. 운영에는 고정·검증·패치 관리된 별도 커널과 rootfs를 사용해야 한다.

참고 문서:

- https://github.com/firecracker-microvm/firecracker/blob/v1.17.0/docs/getting-started.md
- https://github.com/firecracker-microvm/firecracker/blob/v1.17.0/docs/jailer.md
- https://github.com/firecracker-microvm/firecracker/blob/v1.17.0/docs/vsock.md
