# Testing Guide

## Unit Tests

We use **Jest** for unit testing.

```bash
# Run all tests
npm test

# Run governance suites (contracts/policy/types)
npm run test:contracts

# Run fast + governance (what `npm run verify` uses)
npm run test:all

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

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
npx jest --maxWorkers=50% --json --outputFile=/tmp/jest-results.json
node docs/qa/scripts/print_slowest_suites.mjs
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

- `LINEUP_TEST_CONSOLE=1` enables normal console output.
- `LINEUP_TEST_CONSOLE_SILENT=1` additionally silences `console.warn` and `console.error`.

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
