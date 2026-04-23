# Testing Guide

## Unit Tests

We use **Jest** for unit testing.

```bash
# Run product/runtime tests (default Jest surface)
npm test

# Run the same product/runtime surface explicitly
npm run test:unit

# Run tooling/docs Jest suites under src/__tests__/tools
npm run test:tools

# Run governance suites (contracts/policy/types)
npm run test:contracts

# Run every Jest surface
npm run test:all

# Run product/runtime tests in watch mode
npm run test:watch

# Generate product/runtime coverage
npm run test:coverage

# Report the slowest product/runtime suites
npm run test:timings

# Report the slowest tooling/docs suites
npm run test:timings:tools
```

| Script | Surface | Included suites / notes |
| --- | --- | --- |
| `npm test`, `npm run test:unit`, `npm run test:watch`, `npm run test:coverage`, `npm run test:timings` | Product/runtime only | These commands answer the product/runtime question only. |
| `npm run test:timings:tools` | Tooling/docs timings | Reports the slowest tooling/docs Jest suites. |
| `npm run test:tools` | Tooling/docs | Owns Jest-based tooling and docs suites in `src/__tests__/tools/**`. |
| `npm run test:contracts` | Governance | Separate contract, policy, and type test surface. |
| `npm run test:all` | Comprehensive Jest | Unit + tools + contracts. |
| `npm run verify` | Full verification | Broader than `test:all`: typecheck, architecture lint, CSS lint, product/runtime coverage, tooling/docs suites, contracts, docs verification, and the production build. |
| `npm run verify:docs` | Docs-specific verification | Intentionally overlaps with `npm run test:tools`: it still runs the targeted `src/__tests__/tools/verifyDocs.test.ts` proof through `jest.tools.config.js`, even though `verify` also executes the broader tools surface. |

### What to Test

- **Core Logic**: Schedulers, math utilities, Plex data parsing.
- **State Management**: Channel creation, deletion, updates.
- **Orchestration**: ensuring events trigger correct actions.
- **Runtime UI Classes**: Screen/modal/overlay behavior through public APIs and DOM-visible outcomes.

## Behavior-First Unit Testing

- Prefer public behavior assertions (user actions, emitted events, rendered output) over internal implementation details.
- Keep tests deterministic: use fake timers for timing behavior and avoid real-time sleeps.
- Mock network/platform boundaries, but keep module wiring realistic (constructor/startup paths should still execute).
- Add targeted smoke coverage for app/bootstrap startup seams so regressions in initialization are caught early.

### Async Helper House Style

Prefer the shared helpers in `src/__tests__/helpers.ts` before adding local async wait code:

| Need | Preferred helper | Use when | Avoid when |
| --- | --- | --- | --- |
| Flush promise-only work | `flushPromises()` | the code under test only needs microtask turns | a timer or DOM-task turn is part of the contract |
| Control async completion directly | `createDeferred()` | the test owns when an async dependency resolves or rejects | the production code already exposes a concrete promise you can await directly |
| Advance fake timers and settle follow-up promise work | `flushPromisesAndTimers()` | fake-timer callbacks schedule more promise work before the next assertion | the suite uses real timers |
| Poll a fake-timer condition with an explicit timeout budget | `advanceTimersUntil()` | the assertion should become true after bounded timer advancement | a single direct timer advance or awaited promise is enough |
| Cross one real macrotask turn after promise work | `flushPromisesAndMacrotask()` | a real-timer integration boundary only becomes observable after promises and one queued macrotask both complete | the suite uses fake timers or just needs a generic wait |

`flushPromisesAndMacrotask()` is the opt-in escape hatch for real-timer integration coverage only. Do not introduce new raw `setTimeout(...)` waits in suites when one of the existing helpers or a directly awaited production promise can express the same behavior.

### Storage And Global Helper Guidance

Use the shared environment helpers only where multiple suites genuinely share the same setup and restore contract.

- `installMockLocalStorage()` and `restoreOriginalLocalStorage()` in `src/__tests__/mocks/localStorage.ts` own the shared mock-storage seam for suites that need a spy-friendly in-memory `localStorage`.
- `setDevBuildForTest()` and `setDocumentReadyStateForTest()` in `src/__tests__/helpers.ts` own the repeated `__LINEUP_DEV_BUILD__` and `document.readyState` override seams.
- `createBodyAppendedTestContainer()` in `src/__tests__/helpers.ts` owns the narrow "fresh anonymous div appended to document.body" seam for repeated UI screen-root setup.

Keep setup local when the suite is intentionally different:

- real jsdom `localStorage` coverage that should exercise `Storage.prototype`
- mixed restore contracts that pair `localStorage` with `navigator` or another global
- suite-local container IDs, wrapper structure, RAF wiring, or per-instance teardown rules

The goal is lower churn, not one helper for every test environment mutation. If a helper would need options, extra wrapper nodes, or cross-suite restore semantics just to fit a new caller, keep that seam local until repetition becomes real.

## Agent Eval Regression Set

The repo also maintains a small agent-workflow regression set in [`docs/agentic/evals-roadmap.md`](../agentic/evals-roadmap.md) and the tracked harness definition under [`docs/agentic/evals/`](../agentic/evals/README.md).

Use it when you want to judge whether the current workflow and skills are still resisting the failure modes that matter most:

- hotspot growth
- raw storage leakage
- overlay focus/timer leaks
- Plex policy leakage

This eval set is separate from product testing:

- product tests prove application behavior
- agent evals prove workflow quality, boundary discipline, and slop resistance

Keep raw eval outputs local-only, but write a tracked baseline summary after each manual baseline run.

## When to Refactor the Test Suite

Default posture: avoid suite-wide refactors unless there is clear pain.

Refactor when:
- CI or local runs are meaningfully slow (and trending worse).
- Flakes or nondeterminism are recurring (timing, network, global state).
- Many suites repeat the same setup/fixture patterns and changes become expensive.

Avoid refactors when:
- The suite is stable and fast enough for current needs.
- The primary benefit is “prettier tests” without measurable wins (speed, flake reduction, clarity for future changes).

Measure slow suites before/after changes:

```bash
npm run test:timings
npm run test:timings:tools
```

## Coverage Telemetry

`npm run test:coverage` is a reporting surface, not a release gate. Use coverage numbers as telemetry to spot blind spots or compare alternative test investments, not as a reason to keep low-value tests, add threshold policing, or claim a cleanup succeeded on metrics alone.

## Anti-Pattern Policy

- Frozen suites remain the strict gate: zero private probes and zero sleep-based waits.
- Whole-suite enforcement scans tracked `src/` files that belong to the unit + contracts Jest surfaces, and it intentionally excludes `src/__tests__/tools/**`.
- New private-probe keys anywhere in that tracked whole-suite surface fail the policy; the current exceptions live in `src/__tests__/policy/baselines/private-probes.allowlist.txt` and must stay synchronized with `src/__tests__/policy/baselines/private-probes.owner-notes.md`.
- Raw sleep usage is not allowed outside explicitly approved helper coverage; the remaining approved sleep ids live in `src/__tests__/policy/baselines/sleeps-ast.txt` and must stay synchronized with `src/__tests__/policy/baselines/sleeps.owner-notes.md`.
- The current approved sleep exception is a helper self-test for `advanceTimersUntil`; treat it as harness coverage, not as permission to add raw timer waits elsewhere.
- Sleep exceptions use stable ids in the form `<file>|<kind>|<scope_path>|<ordinal>` so surrounding line churn does not invalidate the machine baseline.
- Use `jest.useFakeTimers()` with explicit advancement (`advanceTimersByTime`, `runOnlyPendingTimers`) or existing async helpers before considering any new wait pattern.
- Policy enforcement runs via `src/__tests__/policy/AntiPatterns.policy.test.ts`.
- The policy test also writes debug reports to your OS temp directory:
  - `current-private-probes.json`
  - `current-sleeps.txt`

### Console output during tests

By default, Jest setup silences `console.debug`, `console.log`, and `console.info` to keep test output readable.
Unexpected `console.warn` and `console.error` now fail the owning test by default.

- Register expected warn/error output with `expectConsoleWarn(...)` or `expectConsoleError(...)` from `src/__tests__/helpers.ts`.
- Matchers can be string fragments, `RegExp`, predicates, or exact-argument arrays with Jest asymmetric matchers such as `expect.objectContaining(...)`.
- `LINEUP_TEST_CONSOLE=1` disables unexpected warn/error enforcement and restores live console output for local debugging while still allowing `expectConsoleWarn(...)` and `expectConsoleError(...)` assertions.

*Manual and integration verification still complement unit tests, especially for webOS device behavior.*

## Manual Verification

### Browser Testing

- **Goal**: Verify UI layout, navigation logic, and API calls.
- **Method**: Use `npm run dev` and Chrome DevTools.
- **Key Check**: Resize window to 1920x1080 to match TV resolution.

### Emulator Testing

- **Goal**: Verify platform integration (LS2 API), native video playback, and remote input.
- **Key Check**: HLS playback—verify smooth startup (<3s), no buffering interruptions, correct resolution rendering.

### Physical Device Testing

- **Goal**: Verify real-world performance (FPS, memory usage).
- **Key Check**: Long-term stability (leave running for >1 hour).
