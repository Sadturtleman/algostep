// FE-facing MVP contract. Keep in sync with app.ts; contract tests exercise real responses.
const str = { type: "string" };
const bool = { type: "boolean" };
const integer = { type: "integer" };
const uid = { type: "string", format: "uuid" };
const date = { type: "string", format: "date-time" };
const nullable = (s: any) => ({ ...s, nullable: true });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const arr = (items: any) => ({ type: "array", items });
const obj = (
  properties: Record<string, any>,
  required = Object.keys(properties),
) => ({ type: "object", properties, required });
const enumeration = (...values: string[]) => ({ type: "string", enum: values });
const language = enumeration("python", "cpp", "java");
const source = {
  ...str,
  maxLength: 65536,
  description: "UTF-8 기준 최대 65,536바이트. 단일 파일 전체 프로그램.",
};
const requestKey = {
  ...str,
  minLength: 8,
  maxLength: 100,
  example: "attempt-00000001",
};
const json = (schema: any) => ({ "application/json": { schema } });
const error = (description: string) => ({
  description,
  content: json(ref("Error")),
});
const paths: Record<string, any> = {};
function operation(
  path: string,
  method: string,
  operationId: string,
  tag: string,
  summary: string,
  description: string,
  response: any,
  body?: any,
  publicAccess = false,
) {
  const write = method !== "get";
  const parameters: any[] = [...path.matchAll(/\{(\w+)\}/g)].map((m) => ({
    name: m[1],
    in: "path",
    required: true,
    schema: m[1] === "id" ? uid : str,
  }));
  const security = publicAccess
    ? []
    : write
      ? [{ sessionCookie: [], csrfToken: [] }]
      : [{ sessionCookie: [] }];
  (paths[path] ??= {})[method] = {
    operationId,
    tags: [tag],
    summary,
    description,
    security,
    parameters,
    ...(body ? { requestBody: { required: true, content: json(body) } } : {}),
    responses: {
      "200": {
        description: "성공 (생성·실행 요청도 200)",
        content: json(response),
      },
      "400": error("INVALID_INPUT / INVALID_PATH"),
      "401": error("AUTH_REQUIRED / SESSION_EXPIRED / GOOGLE_TOKEN_INVALID"),
      "403": error("ORIGIN_INVALID / CSRF_INVALID / FEATURE_DISABLED"),
      "404": error("NOT_FOUND / FEATURE_DISABLED"),
      ...(write
        ? {
            "409": error(
              "SAVE_CONFLICT: 최신 기록을 다시 조회하고 사용자 코드와 병합",
            ),
          }
        : {}),
      "429": error(
        "RATE_LIMIT: 일반 API IP당 분당 240회, Google 로그인 분당 20회",
      ),
      "500": error("SYSTEM_ERROR: 재요청 전에 저장·실행 상태 확인"),
      ...(operationId === "googleLogin"
        ? { "503": error("AUTH_NOT_CONFIGURED") }
        : {}),
    },
  };
}
const schemas: Record<string, any> = {
  Error: obj({ code: str, message: str }),
  Ok: obj({ ok: bool }),
  Quiz: obj({ id: str, question: str, options: arr(str) }),
  Topic: obj({
    id: str,
    title: str,
    category: str,
    priority: {
      ...str,
      description: "레거시 필드. UI에서 P0/P1/P2 분류로 노출하지 않음.",
    },
    body: str,
    complexity: { ...str, description: "시간|공간 형식" },
    exampleTopicId: str,
    quiz: ref("Quiz"),
    quizzes: arr(ref("Quiz")),
  }),
  Problem: obj(
    {
      id: str,
      topic_id: str,
      version: integer,
      title: str,
      statement: str,
      input_spec: str,
      output_spec: str,
      constraints_text: str,
      tests: arr(obj({ input: str, expected: str })),
      starters: obj({ python: str, cpp: str, java: str }),
      references_code: obj({ python: str, cpp: str, java: str }),
      complexity_time: nullable(str),
      complexity_space: nullable(str),
    },
    [
      "id",
      "topic_id",
      "title",
      "statement",
      "tests",
      "starters",
      "references_code",
    ],
  ),
  Record: obj({
    id: uid,
    user_id: uid,
    problem_id: str,
    language,
    source,
    revision: { ...integer, minimum: 0 },
    latest_execution_id: nullable(uid),
    created_at: date,
    updated_at: date,
    expires_at: date,
  }),
  RecordListItem: {
    allOf: [
      ref("Record"),
      obj({ title: str, execution_status: nullable(str) }),
    ],
  },
  RecordDetail: {
    allOf: [
      ref("Record"),
      obj({
        reviews: {
          type: "array",
          items: { type: "object" },
          maxItems: 0,
          description: "MVP는 항상 빈 배열",
        },
        execution: {
          oneOf: [
            ref("Execution"),
            { type: "object", nullable: true, enum: [null] },
          ],
        },
      }),
    ],
  },
  TraceStep: obj({
    line: integer,
    event: str,
    locals: { type: "object", additionalProperties: true },
    stack: arr(str),
  }),
  TestResult: obj(
    {
      input: str,
      expected: nullable(str),
      actual: str,
      stderr: str,
      verdict: str,
      elapsedMs: { type: "number", minimum: 0 },
      peakMemoryBytes: { type: "number", minimum: 0 },
      trace: arr(ref("TraceStep")),
      traceTruncated: bool,
    },
    [
      "input",
      "expected",
      "actual",
      "stderr",
      "verdict",
      "elapsedMs",
      "peakMemoryBytes",
    ],
  ),
  Analysis: obj(
    {
      status: enumeration("SUPPORTED", "UNSUPPORTED"),
      method: enumeration("CURATED_REFERENCE_MATCH", "LEXICAL_REFERENCE_MATCH"),
      time: nullable(str),
      space: nullable(str),
      evidence: str,
      language,
      findings: arr({ type: "object", additionalProperties: true }),
    },
    ["status", "time", "space", "evidence", "language", "findings"],
  ),
  ExecutionResult: obj(
    {
      verdict: enumeration(
        "AC",
        "WA",
        "CE",
        "RE",
        "TLE",
        "MLE",
        "OUTPUT_LIMIT",
        "COMPLETED",
      ),
      diagnostics: str,
      tests: arr(ref("TestResult")),
      traceSupport: enumeration("PYTHON", "GDB", "JDI", "UNSUPPORTED"),
      runnerImage: str,
      analysis: ref("Analysis"),
    },
    ["verdict", "tests", "traceSupport", "runnerImage", "analysis"],
  ),
  Execution: obj({
    id: uid,
    record_id: uid,
    snapshot_id: uid,
    request_key: str,
    mode: enumeration("judge", "custom"),
    custom_input: nullable(str),
    status: enumeration("QUEUED", "RUNNING", "SUCCEEDED", "FAILED"),
    result: {
      nullable: true,
      type: "object",
      description:
        "대기 중 null. 완료 시 ExecutionResult, 시스템 실패 시 systemError. SUCCEEDED는 정답이 아닌 실행 처리 완료를 뜻함.",
      oneOf: [
        ref("ExecutionResult"),
        obj({ systemError: str }),
        { type: "object", nullable: true, enum: [null] },
      ],
    },
    attempt: integer,
    created_at: date,
    finished_at: nullable(date),
    lease_token: nullable(uid),
    lease_expires_at: nullable(date),
  }),
  Me: obj({
    user: obj({
      id: uid,
      name: str,
      email: { type: "string", format: "email" },
      isAdmin: bool,
      analyticsId: nullable(uid),
    }),
    csrf: str,
  }),
  Login: obj({
    user: obj(
      {
        id: uid,
        google_subject: str,
        email: str,
        display_name: str,
        created_at: date,
        isAdmin: bool,
        analyticsId: nullable(uid),
      },
      ["id", "email", "display_name", "isAdmin"],
    ),
    csrf: str,
  }),
  Config: obj({
    productMode: enumeration("mvp", "full"),
    googleClientId: str,
    topicIds: nullable(arr(str)),
    features: obj(
      Object.fromEntries(
        [
          "admin",
          "analytics",
          "reviews",
          "payments",
          "pdf",
          "drive",
          "android",
          "support",
          "predictionSync",
        ].map((k) => [k, bool]),
      ),
    ),
    limits: obj(
      Object.fromEntries(
        [
          "testMs",
          "memoryBytes",
          "compileMs",
          "outputBytes",
          "traceSteps",
          "submissionMs",
          "sourceBytes",
          "inputBytes",
          "recordCount",
          "retentionDays",
        ].map((k) => [k, integer]),
      ),
    ),
    ga4MeasurementId: nullable(str),
    reviewEnabled: bool,
    paymentEnabled: bool,
    languages: arr(str),
  }),
};
operation(
  "/api/health",
  "get",
  "health",
  "공통",
  "서버 상태",
  "인증 불필요. DB 상태 점검과는 별개입니다.",
  ref("Ok"),
  undefined,
  true,
);
operation(
  "/api/config",
  "get",
  "config",
  "공통",
  "기능·언어·실행 제한",
  "인증 불필요. UI는 features와 limits를 기준으로 구성합니다. predictionSync=false: 단계별 예측 진행은 클라이언트 상태입니다.",
  ref("Config"),
  undefined,
  true,
);
operation(
  "/api/auth/google",
  "post",
  "googleLogin",
  "인증",
  "Google 로그인",
  "Google Identity Services에서 받은 ID 토큰 전달. 성공 시 HttpOnly session 쿠키(7일) 설정. Origin은 서버 WEB_ORIGIN과 일치해야 합니다. 로그인 user.display_name과 /me의 user.name 차이에 주의하세요.",
  ref("Login"),
  obj(
    {
      credential: { ...str, minLength: 10, maxLength: 8192 },
      client: { ...enumeration("web"), default: "web" },
    },
    ["credential"],
  ),
  true,
);
operation(
  "/api/me",
  "get",
  "me",
  "인증",
  "현재 사용자와 CSRF 토큰",
  "로그인된 브라우저 쿠키로 조회. 반환된 csrf를 변경 요청의 x-csrf-token에 전달합니다.",
  ref("Me"),
);
operation(
  "/api/auth/logout",
  "post",
  "logout",
  "인증",
  "로그아웃",
  "서버 세션 삭제 및 session 쿠키 제거.",
  ref("Ok"),
);
operation(
  "/api/topics",
  "get",
  "topics",
  "학습",
  "MVP 학습 개념 목록",
  "8개 개념과 선택형 퀴즈. 응답 퀴즈에는 정답과 해설이 없습니다. 애니메이션과 단계별 예측은 FE 구현입니다.",
  obj({ topics: arr(ref("Topic")) }),
);
operation(
  "/api/quiz/{topic}",
  "post",
  "answerQuiz",
  "학습",
  "선택형 퀴즈 채점",
  "answer는 0부터 시작하는 선택지 인덱스. requestKey는 사용자별 멱등키로, 같은 키를 재사용하면 기존 결과가 반환됩니다. 다른 문항·답변에는 새 키를 사용하세요.",
  obj({ correct: bool, answer: integer, explanation: str }),
  obj(
    {
      answer: { ...integer, minimum: 0, maximum: 10 },
      requestKey,
      questionId: { ...str, maxLength: 80, default: "core" },
    },
    ["answer", "requestKey"],
  ),
);
operation(
  "/api/problems",
  "get",
  "problems",
  "학습",
  "문제·공개 테스트·권장 코드",
  "MVP 주제에 속한 문제만 반환. 테스트는 모두 공개이며 출력은 공백·줄바꿈까지 엄격하게 비교합니다.",
  obj({ problems: arr(ref("Problem")) }),
);
operation(
  "/api/records",
  "get",
  "records",
  "기록",
  "내 기록 목록",
  "만료되지 않은 본인 기록. updated_at 내림차순. 페이지네이션 없음(최대 100건).",
  obj({ records: arr(ref("RecordListItem")) }),
);
operation(
  "/api/records",
  "post",
  "createRecord",
  "기록",
  "문제 풀이 기록 생성",
  "언어별 starter 코드로 생성. 최대 100건이며 초과 시 생성 시각 기준 가장 오래된 기록 영구 삭제. 보관 기간은 생성 시점부터 30일입니다.",
  ref("Record"),
  obj({ problemId: { ...str, maxLength: 100 }, language }),
);
operation(
  "/api/records/{id}",
  "get",
  "record",
  "기록",
  "기록과 최신 실행 조회",
  "본인 소유의 만료되지 않은 기록만 조회. 다른 사용자 기록도 404 응답.",
  ref("RecordDetail"),
);
operation(
  "/api/records/{id}",
  "patch",
  "saveRecord",
  "기록",
  "코드 자동 저장",
  "현재 revision을 제출하고 응답의 증가된 revision을 보관합니다. 충돌 시 409 SAVE_CONFLICT. 저장은 30일 만료 시각을 연장하지 않습니다.",
  ref("Record"),
  obj({ language, source, revision: { ...integer, minimum: 0 } }),
);
operation(
  "/api/records/{id}",
  "delete",
  "deleteRecord",
  "기록",
  "기록 영구 삭제",
  "확인 UI를 거친 뒤 호출하세요. 연결된 실행도 삭제되며 복구할 수 없습니다.",
  ref("Ok"),
);
operation(
  "/api/records/{id}/executions",
  "post",
  "execute",
  "실행",
  "채점 또는 사용자 입력 실행 요청",
  "저장 완료 후 최신 revision으로 호출. mode=judge는 공개 테스트, custom은 input 사용. requestKey는 기록별 멱등키입니다. 재실행은 새 기록을 만들지 않고 latest_execution_id를 갱신합니다. 반환된 id로 실행 결과를 폴링하세요.",
  ref("Execution"),
  obj(
    {
      requestKey,
      revision: { ...integer, minimum: 0 },
      mode: { ...enumeration("judge", "custom"), default: "judge" },
      input: {
        ...source,
        description:
          "custom 실행 stdin. UTF-8 65,536바이트 이하. 생략하면 빈 문자열.",
      },
    },
    ["requestKey", "revision"],
  ),
);
operation(
  "/api/executions/{id}",
  "get",
  "execution",
  "실행",
  "실행 상태·채점·추적·복잡도 조회",
  "QUEUED → RUNNING → SUCCEEDED/FAILED. SUCCEEDED에서도 verdict=WA 등일 수 있습니다. 최종 상태에서 폴링 중단. 테스트별 10초/512MiB, 컴파일 30초, 제출 전체 120초. 분석은 LLM 없이 검증된 코드만 SUPPORTED이며 그 외 복잡도는 null입니다.",
  ref("Execution"),
);
export const openapi = {
  openapi: "3.0.3",
  info: {
    title: "Algostep MVP API",
    version: "0.2.0",
    description:
      "FE 연동용 실제 구현 명세.\n\n호출 순서: Google 로그인 → /me → /topics·/problems → 기록 생성 → PATCH 저장 → 실행 요청 → 실행 조회.\n\n브라우저 요청에는 credentials: include를 사용합니다. 변경 요청은 허용된 Origin과 x-csrf-token이 필요합니다. Swagger는 같은 서비스에서 로그인한 뒤 사용하세요. Try it out은 실제 데이터를 변경할 수 있습니다.\n\n범위: 웹 MVP. 내부 워커·운영 API는 별도 서버 간 계약이며 이 문서에서 제외합니다. 관리자·결제·리뷰·PDF·Android는 MVP 비활성입니다.",
  },
  servers: [{ url: "/", description: "현재 서버 (동일 출처)" }],
  tags: ["공통", "인증", "학습", "기록", "실행"].map((name) => ({ name })),
  paths,
  components: {
    schemas,
    securitySchemes: {
      sessionCookie: {
        type: "apiKey",
        in: "cookie",
        name: "session",
        description:
          "웹에서 Google 로그인하면 자동 설정되는 HttpOnly 쿠키. 직접 입력하지 마세요.",
      },
      csrfToken: {
        type: "apiKey",
        in: "header",
        name: "x-csrf-token",
        description:
          "/api/me 응답의 csrf. Swagger UI는 변경 요청 직전에 자동 조회합니다.",
      },
    },
  },
};
