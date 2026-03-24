# Contributing to Lineup

Thanks for contributing. This repo values small, well-verified changes and documentation that stays aligned with the code.

## Before You Start

- use the supported Node runtime: `>=22.12.0`
- prefer the repo-pinned local version from `.nvmrc` (`22.19.0` at the time of writing)
- install dependencies from a clean checkout with `npm ci`
- read [Development Setup](docs/development/setup.md) for environment details

## Ways to Contribute

- report bugs: https://github.com/TJZine/Lineup/issues/new?template=bug_report.md
- request features: https://github.com/TJZine/Lineup/issues/new?template=feature_request.md
- improve docs, onboarding, or troubleshooting guides
- submit focused code fixes, tests, or refactors

## Local Setup

```bash
git clone https://github.com/TJZine/Lineup.git
cd Lineup
nvm use
npm ci
```

## Development Workflow

1. Create a focused branch.
2. Make the smallest change that solves the task.
3. Update docs if behavior, setup, or workflows changed.
4. Run the right verification commands.
5. Open a pull request with a clear summary and evidence.

Recommended branch prefixes:

- `feat/`
- `fix/`
- `docs/`
- `refactor/`
- `test/`
- `chore/`

## Verification

For most app changes:

```bash
npm run verify
```

For docs-only changes:

```bash
npm run verify:docs
```

Useful narrower commands:

```bash
npm run typecheck
npm run lint
npm run lint:css
npm run test:all
```

## Pull Requests

Please include:

- what changed
- why it changed
- how you verified it
- any follow-up work or known limits

Conventional Commits are preferred:

```text
feat(scope): short description
fix(scope): short description
docs: short description
```

## Documentation Expectations

If your change affects setup, workflows, or user-visible behavior, update the matching docs in the same pass. Good entry points:

- [README](README.md)
- [Development Quick Reference](dev-workflow.md)
- [Development Setup](docs/development/setup.md)
- [Getting Started](docs/getting-started/README.md)
- [User Guide](docs/user-guide/README.md)

## Review Bar

Before opening a PR, make sure:

- the change is scoped and understandable
- verification commands are listed in the PR
- docs and code do not contradict each other
- no unrelated generated or local-only files are mixed into the diff
