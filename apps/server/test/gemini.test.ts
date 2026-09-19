import { test } from "node:test";
import assert from "node:assert/strict";
import { llmOptions, requestReview } from "../src/llm.js";
test("Gemini configuration is disabled without a key and fixes the Google endpoint", () => {
  assert.equal(llmOptions({}), undefined);
  const options = llmOptions({ GEMINI_API_KEY: "test-key" })!;
  assert.equal(options.model, "gemini-3.8-flash");
  assert.equal(new URL(options.url).host, "generativelanguage.googleapis.com");
  assert.throws(() =>
    llmOptions({ GEMINI_API_KEY: "test", GEMINI_MODEL: "../bad?key=x" }),
  );
});
test("Gemini sends three inputs, requests structured output and accounts thinking separately", async () => {
  const payload = {
    userCode: "print(1)",
    recommendedCode: "print(1)",
    problem: { statement: "one" },
  };
  const options = llmOptions({ GEMINI_API_KEY: "test-key" })!;
  const result = await requestReview(
    {
      ...options,
      fetcher: (async (url, init) => {
        assert.ok(!String(url).includes("test-key"));
        assert.equal(
          new Headers(init?.headers).get("x-goog-api-key"),
          "test-key",
        );
        const body = JSON.parse(String(init?.body));
        assert.deepEqual(JSON.parse(body.contents[0].parts[0].text), payload);
        assert.equal(body.generationConfig.maxOutputTokens, 8192);
        assert.equal(body.generationConfig.thinkingConfig.thinkingLevel, "low");
        return new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: "STOP",
                content: {
                  parts: [
                    { thought: true, text: "private thought" },
                    { text: '{"logicalErrors":"없음"}' },
                  ],
                },
              },
            ],
            usageMetadata: {
              promptTokenCount: 4000,
              candidatesTokenCount: 1500,
              thoughtsTokenCount: 500,
            },
          }),
        );
      }) as typeof fetch,
    },
    payload,
  );
  assert.equal(result.complete, true);
  assert.ok(!result.text.includes("private thought"));
  assert.deepEqual(result.usage, { input: 4000, output: 1500, thinking: 500 });
});
test("Gemini truncation is not a completed review and absent usage is not zero", async () => {
  const options = llmOptions({ GEMINI_API_KEY: "test" })!;
  const result = await requestReview(
    {
      ...options,
      fetcher: (async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: "MAX_TOKENS",
                content: { parts: [{ text: "{}" }] },
              },
            ],
          }),
        )) as typeof fetch,
    },
    {},
  );
  assert.equal(result.complete, false);
  assert.deepEqual(result.usage, { input: null, output: null, thinking: null });
});
