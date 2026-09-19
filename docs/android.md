# Android 앱

`apps/android`는 Kotlin/Android WebView 클라이언트다. Android 8 이상을 지원하며 설명·퀴즈만 제공한다. 화면 폭과 관계없이 네이티브 브리지가 있으면 학습 화면만 표시하고 Android 세션의 서버 API도 같은 범위로 제한한다.

## 빌드

JDK 17, Gradle 8.11.1, Android SDK 35에서:

```
gradle -p apps/android assembleDebug lintDebug testDebugUnitTest -PwebOrigin=https://YOUR_DOMAIN
```

GitHub Actions의 Android package도 같은 빌드를 실행하고 debug APK를 보관한다. 기본 origin `https://algostep.invalid`는 잘못된 서비스에 연결되지 않게 하는 자리표시자다. 도메인을 정한 뒤 workflow_dispatch로 실제 HTTPS origin을 넣어 다시 빌드한다. 배포용 서명 키/Play Console 게시와 스토어 검토는 별도다. 서명 키는 저장소에 넣지 않는다.

## 인증과 통신

- Google Cloud 프로젝트에서 웹 클라이언트와 Android 패키지 `com.algostep.app` + 서명 인증서 SHA-1에 해당하는 Android OAuth 클라이언트를 등록한다.
- 웹 API config의 웹 client ID를 Credential Manager `GetSignInWithGoogleOption`에 전달한다. 서버가 ID 토큰의 audience·서명·email_verified와 일회용 nonce를 검증한다.
- nonce는 5분 유효하며 HttpOnly 쿠키와 DB challenge를 대조하고 성공한 인증에서 한 번만 소비한다. ID 토큰은 저장하지 않는다. 세션 쿠키는 WebView가 유지한다.
- 허용된 HTTPS origin의 최상위 프레임만 `addWebMessageListener`를 통해 로그인할 수 있다. 파일/콘텐츠 접근·혼합 콘텐츠·서드파티 쿠키를 비활성화하고 다른 origin 탐색을 차단한다. SSL 오류는 우회하지 않는다.
- 로그아웃 시 서버 세션을 제거하고 네이티브 Credential Manager 상태도 지운다.
- 최초 페이지 로드 실패는 네이티브 전체 화면 재연결 CTA, 로드 후 API 오류는 웹 전체 화면 복구 CTA로 처리한다.

실제 Google 로그인, 계정 전환, 회전/백그라운드 복귀, 네트워크 단절, TalkBack, release 서명 인증은 OAuth/도메인 설정 후 실제 기기에서 검증해야 한다. APK 빌드 통과가 외부 로그인 검증을 의미하지 않는다.

참조: https://developer.android.com/identity/sign-in/credential-manager-siwg-implementation 및 https://developer.android.com/reference/androidx/webkit/WebViewCompat
