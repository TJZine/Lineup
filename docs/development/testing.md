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

`npm test`, `npm run test:unit`, `npm run test:watch`, `npm run test:coverage`, and `npm run test:timings` all answer the product/runtime question only.

`npm run test:tools` owns Jest-based tooling and docs suites in `src/__tests__/tools/**`.

`npm run test:contracts` remains the separate governance surface for contract, policy, and type tests.

`npm run test:all` is the comprehensive Jest aggregate: unit + tools + contracts.

`npm run verify` remains broader than `test:all`: it still includes typecheck, architecture lint, CSS lint, product/runtime coverage, tooling/docs suites, contracts, docs verification, and the production build.

`npm run verify:docs` intentionally overlaps with `npm run test:tools`. It still runs the targeted `src/__tests__/tools/verifyDocs.test.ts` proof through `jest.tools.config.js`, even though `verify` also executes the broader tools surface.

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

## Anti-Pattern Policy (Frozen Suites)

- Do not probe private members on the SUT (no underscore-field pokes via casted internals).
- Do not use real-time wait helpers based on `setTimeout`/`setInterval` in tests.
- Use `jest.useFakeTimers()` with explicit advancement (`advanceTimersByTime`, `runOnlyPendingTimers`) for timing assertions.
- Policy enforcement runs via `src/__tests__/policy/AntiPatterns.policy.test.ts`.
- Baselines live in `src/__tests__/policy/baselines/` (`private-probes.allowlist.txt`, `sleeps-ast.txt`).
- The policy test also writes debug reports to your OS temp directory:
  - `current-private-probes.json`
  - `current-sleeps.txt`

### Console output during tests

By default, Jest setup silences `console.debug`, `console.log`, and `console.info` to keep test output readable.
Unexpected `console.warn` and `console.error` now fail the owning test by default.

- Register expected warn/error output with `expectConsoleWarn(...)` or `expectConsoleError(...)` from `src/__tests__/helpers.ts`.
- Matchers can be string fragments, `RegExp`, predicates, or exact-argument arrays with Jest asymmetric matchers such as `expect.objectContaining(...)`.
- `LINEUP_TEST_CONSOLE=1` disables the warn/error guard and restores live console output for local debugging.

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
