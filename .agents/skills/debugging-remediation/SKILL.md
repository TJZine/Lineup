---
name: debugging-remediation
description: Use for a Lineup bug, regression, failing test, or unexplained runtime symptom whose cause is not yet established.
---

# Debugging Remediation

Establish the exact symptom and expected behavior, reproduce through the cheapest
real boundary, identify the failing owner, and reject plausible alternative causes
with evidence before fixing. Choose the narrowest remediation seam and a proof that
would fail for the original cause. Stop if investigation reveals a product or owner
decision outside scope. Do not patch the stack-trace line without tracing the bad
state to its source.
