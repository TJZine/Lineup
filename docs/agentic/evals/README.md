# Agent Workflow Evals

Use small comparative evals to decide whether workflow scaffolding improves real
Lineup outcomes. Evals are optional engineering evidence, not a mandatory closeout
artifact for ordinary changes.

## Method

1. Select 6-10 representative tasks from real bugs, features, refactors, and review
   failures. Include cases where extra planning/review should help and cases where it
   should not trigger.
2. Run each task in a fresh context against the baseline and proposed workflow.
3. Grade final repository state and verification outcomes, not policy-word matching.
4. Record only concise summaries. Keep raw transcripts and generated artifacts local.

Measure:

- requested outcome correct and complete;
- regressions or escaped defects;
- accepted material review findings;
- rework rounds and agent passes;
- wall time;
- observed tokens, credits, or cost when exposed;
- required-reading bytes as a context-cost proxy.

Do not score finding volume, verbosity, number of agents, or adherence to incidental
wording as quality. A lighter workflow wins when outcomes are equal or better.

## Prompt Bank

Files under `prompts/` are optional scenarios. Use only prompts relevant to the
changed workflow. Retire or update a prompt when it encodes removed roles, launchers,
or package schemas; do not make the verifier preserve it.

Tracked baseline summaries should contain the scenario, result, material misses,
verification, measured efficiency proxies, and durable conclusion. Raw outputs stay
under ignored/local storage.

Re-run the small comparison when orchestration policy, role topology, model defaults,
skill routing, or verifier scope changes materially. Do not run the entire prompt bank
by default.
