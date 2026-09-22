# Evaluation Engine Documentation (M9)

## Overview
The evaluation engine handles the automated grading of candidate attempts. It executes asynchronously to ensure the main API remains responsive and can handle complex evaluation workloads like coding execution or future LLM-based grading.

## Idempotency and Determinism
- **Immutability**: All evaluations are strictly computed against the `AssessmentVersion.snapshot` tied to the attempt at the moment of start. Even if recruiters edit the draft assessment, historical scores are immutable.
- **Idempotency**: The worker uses `upsert` exclusively for `EvaluationResult` and `AttemptResult`. A crash and retry will never yield double-counted scores.

## Question Type Support
1. **MCQ (Single)**: Strict match between `optionId` and the configuration's `isCorrect` flag.
2. **MCQ (Multi)**: Strict set-equality match of `optionIds`.
3. **True/False**: Same logic as MCQ (Single).
4. **Short Answer**: Exact string match, case-insensitive and trimmed.
5. **Coding**: Evaluated during the test (M7). The M9 pipeline simply aggregates the final score from the asynchronous worker without re-running the docker containers, ensuring rapid final submission speeds.

## Reporting API
The `ReportsModule` exposes tenant-isolated endpoints:
- **`GET /assessments/:assessmentId`**: Aggregates `completionRate`, `averageScore`, and `passRate`.
- **`GET /attempts/:attemptId`**: Returns the `AttemptResult` alongside proctoring signals.
- **`GET /attempts/:attemptId/export`**: Returns a JSON structure prepared for frontend PDF rendering, ensuring fast response times without heavy backend rendering overhead.
