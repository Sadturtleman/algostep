import { practiceTopic } from "../apps/server/src/focused-concepts.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { conceptUses } from "../apps/web/src/concept-uses.js";
import {
  learningFrames,
  checkpoints,
} from "../apps/web/src/prediction-model.js";
mkdirSync("tmp/learning-v2", { recursive: true });
const data = [...new Set(Object.keys(conceptUses).map(practiceTopic))].map(
  (topic) => ({
    topic,
    frames: learningFrames(topic),
    checkpoints: checkpoints(topic).length,
  }),
);
if (data.some((x) => !x.frames.length || !x.checkpoints))
  throw new Error(
    JSON.stringify(
      data
        .filter((x) => !x.frames.length || !x.checkpoints)
        .map((x) => ({
          topic: x.topic,
          frames: x.frames.length,
          checks: x.checkpoints,
        })),
    ),
  );
writeFileSync("tmp/learning-v2/frames.json", JSON.stringify(data));
console.log(
  `${data.length} topics, ${data.reduce((sum, x) => sum + x.checkpoints, 0)} prediction checkpoints`,
);
