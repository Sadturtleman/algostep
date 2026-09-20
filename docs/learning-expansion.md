# Learning catalog and payment preview

## User-visible behavior

- Main content grows to 1800 px on wide screens, with responsive gutters.
- Concept, prediction, and editor remain separate paths. The concept example panel switches between animation and manual examples through a vertical keyboard-accessible tab list. Custom inputs are collapsed initially.
- Arrays display their value above `[index]`. GIF labels are measured against their boxes; changed/current values and completed visits have separate colors. Both themes are generated from deterministic traces.
- Every concept has a worked application with concrete inputs and outcomes. A divider precedes the complexity table, which separates the core operation's assumptions from the entire coding exercise's cost.
- The catalog has 200 distinct titled lessons: 47 foundational topics and 153 focused lessons. Focused lessons teach operations, invariants, boundaries, and extensions. They explicitly share their parent's executable example, state-prediction sequence, and coding exercise; they do **not** claim to have 153 new algorithm implementations. Each has its own principle and concrete worked case. Existing 47 coding problems and reference implementations remain intact.
- `/plans` and `/checkout` are authenticated presentation-only pages. The free plan includes 3 LLM reviews per KST calendar month without rollover. Paid price, quota, renewal and refund policy are unspecified. No payment credentials are collected, no purchase endpoint is called, and no entitlement or charge is created.

## Data and validation

`focused-concepts.ts` is shared by the server seed and web catalog. Seeds insert new IDs idempotently and preserve published content. Each topic still exposes three quizzes, using the parent's supplementary quizzes for focused lessons. Parent mappings are used to validate code/record routes on the client; server ownership and exercise validation remain unchanged.

`scripts/export-learning-frames.ts` exports unique executable parent examples. `scripts/render-learning-gifs.py` renders all 47 algorithms in light/dark GIF and PNG assets, fits labels to boxes, and highlights changes. `ALGOSTEP_FONT` can select a compatible Korean font on other platforms.

Validation covers 200 unique catalog entries, parent exercise mapping and seed preservation, animation assets and answerable checkpoints, all concept routes, wide/mobile layout, vertical tab keyboard navigation, code restoration, and payment preview non-mutation.
