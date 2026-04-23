# Sleep Exception Owner Notes

| Sleep ID | Owner | Rationale | Revisit Trigger | Cleanup Lane |
| --- | --- | --- | --- | --- |
| `src/__tests__/helpers.test.ts\|timer-call\|advanceTimersUntil > resolves when the assertion becomes true exactly at the timeout boundary\|1` | `src/__tests__/helpers.test.ts` | This helper self-test intentionally exercises the real timer branch that `advanceTimersUntil` advances to the timeout boundary. | Remove when the helper contract can prove the same boundary behavior without scheduling a real timer inside its own self-test. | `T4-W1` |
