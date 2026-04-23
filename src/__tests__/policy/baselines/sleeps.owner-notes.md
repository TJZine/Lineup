# Sleep Exception Owner Notes

| Sleep ID | Owner | Rationale | Revisit Trigger | Cleanup Lane |
| --- | --- | --- | --- | --- |
| `src/__tests__/helpers.test.ts\|timer-call\|advanceTimersUntil > resolves when the assertion becomes true exactly at the timeout boundary\|1` | `src/__tests__/helpers.test.ts` | This helper self-test intentionally schedules the timeout-boundary callback that `advanceTimersUntil` must observe, so the remaining raw timer call is approved residual helper coverage rather than open suite debt. | Remove when the helper contract can prove the same timeout-boundary behavior clearly without scheduling a real timer inside its own self-test. | `T4-W2` |
