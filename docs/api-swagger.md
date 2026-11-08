# Algostep MVP API · Swagger

서버 실행 후 `/docs`에서 Swagger UI, `/openapi.json`에서 OpenAPI 3.0.3 JSON을 확인합니다. Swagger 리소스는 서버가 직접 제공하며 CDN이나 외부 validator로 명세를 전송하지 않습니다.

공유할 명세 파일: [openapi.json](./openapi.json). Swagger Editor나 API 클라이언트에 가져올 수 있습니다.

## 로컬 실행

```sh
npm ci
npm run dev
```

웹 개발 서버의 `http://localhost:5173/docs`에 접속하세요. Vite가 문서와 API 요청을 백엔드 3001 포트로 프록시합니다. 백엔드 단독 문서 주소는 `http://localhost:3001/docs`입니다. 서비스 웹에서 Google 로그인한 동일 브라우저를 사용해야 인증 API를 호출할 수 있습니다. 변경 요청의 Origin은 서버 `WEB_ORIGIN`과 일치해야 하므로, 웹과 API가 분리된 개발 환경에서는 읽기·명세 확인 위주로 사용하거나 개발 서버를 동일 출처로 구성하세요. 운영에서는 같은 출처의 웹과 `/docs`를 사용합니다.

Swagger UI는 변경 요청 전 `/api/me`로 CSRF 토큰을 가져옵니다. HttpOnly 세션 쿠키를 직접 입력할 필요가 없습니다. Try it out은 실제 저장·실행·삭제 요청입니다.

## FE 연동 순서

1. `/api/config`에서 기능과 제한을 조회하고 Google ID 토큰을 `/api/auth/google`에 전달합니다.
2. 쿠키를 포함해 `/api/me`를 조회합니다. 응답의 `csrf`를 변경 요청의 `x-csrf-token`에 보냅니다.
3. `/api/topics`와 `/api/problems`에서 콘텐츠를 조회합니다. 단계별 예측 화면의 진행 상태는 FE가 관리하며 별도 동기화 API는 없습니다.
4. `POST /api/records`로 풀이를 시작합니다. `PATCH /api/records/{id}`로 저장하고 최신 `revision`을 유지합니다.
5. 저장 완료 후 `/api/records/{id}/executions`를 호출합니다. 네트워크 재시도에는 같은 `requestKey`, 새로운 실행에는 새 키를 사용합니다.
6. `/api/executions/{id}`를 조회하다가 `SUCCEEDED` 또는 `FAILED`이면 폴링을 중단합니다. 정답 여부는 `result.verdict`로 판단합니다.
7. 409 충돌 시 사용자 코드를 보존하고 최신 기록을 조회합니다. 401이면 재로그인, 403이면 Origin과 CSRF를 확인합니다.

## 범위와 유지보수

인증·학습·기록·실행의 FE용 15개 operation을 제공합니다. 내부 워커와 운영 API는 FE용 명세에서 제외했습니다. 관리자·결제·리뷰·PDF·Android는 MVP 비활성입니다.

원본은 `apps/server/src/openapi.ts`입니다. API 변경 후 `npm run docs:export`로 JSON을 갱신하세요. `apps/server/test/openapi.test.ts`는 OpenAPI 문법과 실제 DB를 사용하는 주요 응답, 인증·CSRF 보호를 검증합니다. 문서 스키마는 런타임 응답 직렬화에 사용하지 않으므로 기존 응답을 제거하거나 변경하지 않습니다.

