import { conceptCost } from "../../web/src/concept-costs.js";
import { focusedConcepts, practiceTopic } from "../src/focused-concepts.js";
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
  checkpoints,
  matchesAnswer,
  answerText,
} from "../../web/src/prediction-model.js";
import { conceptUses } from "../../web/src/concept-uses.js";
import { readRoute } from "../../web/src/router.js";
test("every published concept has answerable prediction checkpoints and animation assets", () => {
  assert.equal(Object.keys(conceptUses).length, 200);
  for (const topic of Object.keys(conceptUses)) {
    assert.equal(conceptCost(topic).length, 3);
    assert.ok(conceptCost(topic).every((s) => s.length > 0));
    const checks = checkpoints(topic);
    assert.ok(checks.length, topic);
    for (const check of checks) {
      assert.ok(
        matchesAnswer(answerText(check.answer), check.answer),
        `${topic}: ${check.field}`,
      );
      assert.equal(matchesAnswer("definitely-wrong", check.answer), false);
      if (check.choices)
        assert.ok(check.choices.some((c) => c.value === check.answer));
    }
    for (const theme of ["light", "dark"])
      for (const ext of ["png", "gif"])
        assert.ok(
          existsSync(
            `apps/web/public/learning/${practiceTopic(topic)}-${theme}.${ext}`,
          ),
        );
  }
});
test("prediction answers preserve order and strings; numeric formatting is accepted", () => {
  assert.ok(matchesAnswer("1, 2, 3", [1, 2, 3]));
  assert.ok(matchesAnswer("[]", []));
  assert.ok(matchesAnswer('["shortest path", "∞"]', ["shortest path", "∞"]));
  assert.equal(matchesAnswer("3,2,1", [1, 2, 3]), false);
  assert.ok(matchesAnswer("05", 5));
  assert.equal(matchesAnswer("", 0), false);
});
test("routes reject malformed steps, extra segments and unknown admin sections", () => {
  assert.equal(readRoute("/learn/tree/predict/2").step, 2);
  for (const path of [
    "/learn/tree/predict/0",
    "/learn/tree/predict/no",
    "/learn/tree/concept/extra",
    "/admin/invalid",
    "/nope",
  ])
    assert.equal(readRoute(path).page, "not-found");
  assert.equal(readRoute("/records/abc").recordId, "abc");
  assert.equal(readRoute("/learn/tree/code?record=abc").recordId, "abc");
});

test("200 curriculum entries are distinct and focused lessons have concrete worked cases", () => {
  assert.equal(focusedConcepts.length, 153);
  assert.equal(new Set(focusedConcepts.map((c) => c.id)).size, 153);
  assert.equal(new Set(focusedConcepts.map((c) => c.title)).size, 153);
  for (const c of focusedConcepts) {
    assert.ok(conceptUses[c.parent], c.id);
    assert.ok(c.principle.length > 25, c.id);
    assert.ok(c.example.length > 35, c.id);
    assert.ok(/[0-9A-Z가-힣]/.test(c.example), c.id);
  }
});
