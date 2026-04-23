# Sleep Exception Owner Notes

| Sleep ID | Owner | Rationale | Revisit Trigger | Cleanup Lane |
| --- | --- | --- | --- | --- |
| `src/__tests__/helpers.test.ts\|timer-call\|advanceTimersUntil > resolves when the assertion becomes true exactly at the timeout boundary\|1` | `@TJZine` | This helper self-test intentionally schedules the timeout-boundary callback that `advanceTimersUntil` must observe, so the remaining raw timer call is approved residual helper coverage rather than open suite debt. | Remove when the helper contract can prove the same timeout-boundary behavior clearly without scheduling a real timer inside its own self-test. | `T4-W2` |
| `src/__tests__/helpers.test.ts\|timer-call\|flushPromisesAndTimers > flushes promise work on both sides of a fake-timer pass\|1` | `@TJZine` | This helper self-test intentionally queues a zero-delay timer so `flushPromisesAndTimers()` proves the fake-timer pass drains timer work and its follow-on microtask in one bounded helper seam. | Remove when the helper contract can demonstrate the same timer-plus-microtask behavior without an explicit zero-delay timer in the self-test. | `T4-W2` |
