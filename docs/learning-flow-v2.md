# 주소 기반 3단계 학습

Figma 기준: [08 · Learning flow v2](https://www.figma.com/design/lPDjWigwlNvT2oAjAjxoyx?node-id=77-5616).

| 화면 | 주소 | 동작 |
| --- | --- | --- |
| 학습 목록 | `/`, `/learn` | 종류별 47개 개념 |
| 1. 개념 | `/learn/:topicId/concept` | 개념·용도, 라이트/다크 GIF, 상세 단계별 예제 |
| 2. 예측 | `/learn/:topicId/predict/:step` | 현재 상태와 다음 상태의 핵심 값/위치/계산 표를 비교하고 답 제출 |
| 3. 코드 | `/learn/:topicId/code` | 해당 문제의 기존 기록 재사용 또는 첫 기록 자동 생성 |
| 문제 | `/problems`, `/problems/:problemId` | 목록 및 바로 코드 작성 |
| 기록 | `/records`, `/records/:recordId` | 저장된 코드·실행·리뷰 |
| 리뷰 상세 | `/records/:recordId/reviews/:reviewId` | 리뷰 시점의 코드와 결과 |
| 문의 | `/support`, `/support/:inquiryId` | 본인 문의 목록 및 상세 |
| 관리자 | `/admin`, `/admin/:section` | overview / finance / users / support / events |

HTML 진입점과 React 앱은 공유하되 브라우저 History API와 URL로 화면을 구분한다. 서버는 HTML 페이지 직접 진입을 index.html로 연결하며 존재하지 않는 API와 자산은 404로 유지한다. 로그인 전 주소를 보존하고, 알려지지 않은 화면에는 복귀 CTA를 제공한다.

예측은 기존 알고리즘의 결정적 계산 결과를 사용한다. 47개 개념에 452개 체크포인트가 있으며 LLM을 사용하지 않는다. 이진 탐색은 배열 위치, 그래프·트리는 정점 선택, 나머지는 다음 계산 값·순서·표의 행을 입력한다. 배치 이동 자체는 답으로 취급하지 않는다. 틀린 답은 다음 단계 이동을 막으며 수정 후 재시도할 수 있다. 답과 피드백은 사용자·개념·단계별 sessionStorage에 저장하여 같은 탭의 새로고침과 이전/다음 이동에 복원한다. 브라우저를 닫은 뒤의 진도 동기화는 제공하지 않는다.

코드 기록 ID는 URL에 보존한다. 새로고침이나 뒤로가기로 기록을 추가 생성하지 않으며 화면 이동 시 편집 내용을 저장한다. 직접 코드 주소로 접근할 수도 있다. 모바일 웹과 Android는 개념·예측만 제공하고 코드 주소 접근으로 기록을 만들지 않는다.

GIF는 `scripts/export-learning-frames.ts`로 실제 예제 계산을 내보내고 `scripts/render-learning-gifs.py`로 생성한다. 47개 × 2테마의 GIF와 첫 장면 PNG가 약 5MB이며 선택한 개념의 파일만 브라우저에서 요청한다. GIF 자동 재생을 끄면 첫 장면 PNG를 표시한다. 프레임 단위 일시정지·앞뒤 이동은 아래 상세 예제를 사용한다. OS 동작 줄이기 설정에서는 PNG로 시작한다.

`PREDICTION_CHECKED` 이벤트는 개념 ID·단계·정오답만 수집하며 기존 GA4/Amplitude 전송 경로를 사용한다. 작성한 답·코드·문의 내용은 이 이벤트에 포함하지 않는다. 브라우저가 판정한 학습 이벤트이므로 시험 성적이나 결제 근거로 사용하지 않는다.
