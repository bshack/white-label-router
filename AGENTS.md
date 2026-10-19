# Agent guide — white-label-router

History API routing with progressive link enhancement, route guards, and view lifecycles.

Verified against `package.json`, `README.md`, and `.github/workflows/security.yml` on October 19, 2026. Recheck those files when commands or supported environments change.

## Code map

- `src/index.ts`: the whole implementation, one `Router` class plus the `Router.*` type namespace (contracts in `src/AGENTS.md`).
- `test/*.test.js`: Node tests against built `dist/`. `navigation*.test.js` covers browser behavior with stubbed globals, `server*.test.js` the DOM-free path, `regressions.test.js` re-entrancy, click fallback, popstate, focus, and key-encoding fixes, `runtime-parity`, `package-exports`, and `smoke` the shared contract and entry points.
- `test-types/consumer.mts` + `tsconfig.consumer.json`: consumer type checks.
- `dist/index.js` and `dist/index.d.ts`: package entry points (tracked, generated).
- `docs/runtime-compatibility.md`: browser/server runtime contract.

## Toolchain

Node.js `^22.18.0 || >=24.11.0` (CI uses Node 24) and npm >=11.0. Run everything from the repository root. Install once:

```sh
npm ci --ignore-scripts
```

**Fast loop**, while iterating:

```sh
npm run build && node --test test/<existing-file>.test.js
```

Substitute an existing test file. A focused run never replaces the full gate.

**Full gate**, before calling a change done:

```sh
npm run lint && npm run coverage && npm run audit
```

`npm run coverage` runs the build (which typechecks), the consumer type checks, and every Node test, and enforces 100% statements, branches, functions, and lines per implementation file. That covers `npm run typecheck` and `npm test`, so they don't need separate runs. Lint warnings are failures. No formatter script is configured. CI also uploads generated package artifacts, packs the package, and verifies that the packed Router package installs and exposes the expected runtime entry point.

Source-first testing policy: authored source and the committed lockfile are authoritative. Keep behavior, consumer-type, 100% coverage, build, audit, package, and packed-install verification strict. Do not use committed `dist/` synchronization as a correctness gate, or commit generated `dist/` from CI just to keep it in sync, unless the release workflow explicitly requires source-controlled artifacts. Reduce CI noise by removing brittle synchronization checks, never by weakening tests, lowering coverage, skipping type checks, or bypassing package or runtime verification.

## Generated files

This repository is a library with no development server. Exercise browser behavior through the existing tests or a consuming application. The documented workflow needs no production credentials.

Edit authored TypeScript, not compiled JavaScript or declarations. Generate `dist/` through the existing compiler when validating, packaging, or releasing. Review generated artifacts when they matter to the change, but do not require a PR or bot job to commit compiler output just to satisfy a drift check.

`dist/` is tracked, and the build rewrites it (so do `npm test`, `npm run coverage`, and `npm ci` without `--ignore-scripts`). If `dist/` was clean before you started and the task doesn't call for regenerated output, restore it before reviewing your diff: run `git checkout -- dist` and delete any untracked files the build added under `dist/`. Never do this when `dist/` already had changes before your work.

## Architectural boundaries

Preserve real links, modified-click/download/cross-origin behavior, path-boundary matching, and back/forward navigation. Remove listeners on teardown. Client guards are not server authorization; title and focus changes must respect route context.

---

## Working agreement

The user is the decision-maker; you are an assistant. Default to momentum: make routine, low-risk, reversible decisions that follow repository conventions without asking, and disclose material assumptions in your final report. Stop and ask only for the items under **Ask first** or when a decision is materially ambiguous, risky, or hard to reverse: **stop → explain → ask → proceed.**

### 1. Before changing anything

- Read this file, any more specific `AGENTS.md` under the directory you are editing (the most specific applies), and the relevant README/CONTRIBUTING/docs.
- Run `git status`. Pre-existing uncommitted changes are the user's: never overwrite, discard, or assume you made them. If they conflict with the task, ask.
- Read the relevant code and its tests. Search for existing functions, utilities, patterns, and dependencies before writing new ones: **reuse → extend → refactor → create.**
- When practical, reproduce the issue or run the fast loop to get a baseline. Record pre-existing failures; do not claim you caused or fixed them without evidence.
- Verify that an API, option, config value, or behavior exists before relying on it. Never present an assumption as fact. Accuracy beats speed.
- For complex tasks, state the plan before implementing.

### 2. Making the change

- Implement what was asked. Do not invent business rules or UI, API, validation, data, error-handling, performance, or security behavior beyond the request and existing behavior. If interpretations differ materially, ask.
- Make the smallest, simplest correct change. New abstractions, patterns, frameworks, configuration, and dependencies need a reason.
- Stay in scope: no unrelated refactors, renames, formatting, upgrades, configuration changes, cleanup, or file moves. Report unrelated bugs, debt, or security concerns instead of fixing them. Stop once the request is done and verified.
- Follow existing conventions: naming, structure, error handling, logging, imports, tests, and docs. Do not add a new formatter or lint tool, or change architectural patterns because another approach seems better.
- Use the prescribed runtime, npm, and the committed lockfile. Never switch package managers, regenerate the lockfile unnecessarily, or hand-edit generated dependency metadata.
- Edit authored source or generators, not generated output. Regenerate and validate generated artifacts only when they are expected to be committed.
- Comments explain *why*, not *what*. Document new or changed public functions in the existing TSDoc/JSDoc style.
- Keep changes small, focused, reviewable, and reversible through git.

### 3. Tests

- Add or update tests for meaningful behavior changes, following existing patterns. Test outcomes, error paths, boundaries, and regressions, and where relevant re-entrancy, concurrency, retries, cancellation, partial failure, and cleanup.
- Change an existing test only when the intended behavior changed or the test is demonstrably wrong, and say why.

### 4. Never hide failures

Do not disable, delete, or skip tests; weaken assertions; lower coverage; disable lint rules; suppress type or compiler errors; disable security checks; silence warnings you do not understand; or add hacks to make validation pass. Find the root cause: fix it if it is in scope, otherwise report it. A check made green by hiding the problem is not verification.

### 5. Verify

- **While iterating:** run the fast loop under **Toolchain** for the files you touched.
- **Before calling it done:** run the full gate under **Toolchain**. Claim a check passed only if you ran it and it passed.
- **Review the whole `git diff`:** every file must be relevant, with no temp files, debug code, secrets, unrelated formatting, accidental generated output, or overwritten user work. Investigate anything unexpected.
- If something could not be verified, say what was and was not verified, why, and what to check next. Do not claim regressions are ruled out beyond what your validation covered.

### 6. Security and data

- Treat credentials, tokens, keys, secrets, personal data, customer data, and internal security information as confidential. Never print, log, or commit them, embed them in code, docs, or fixtures, or copy them unnecessarily. Use synthetic data.
- Preserve authentication and authorization boundaries and secure defaults. Validate untrusted input at trust boundaries, encode output for its destination context, parameterize queries, apply least privilege, and never rely only on client-side checks for security.
- Vet new or changed dependencies for provenance, known vulnerabilities, maintenance status, and license.

### 7. Ask first

Get explicit approval before:

| Area | Requires approval |
|---|---|
| Production | Deploying or triggering deploys; changing production infrastructure, environment variables, secrets, services, or databases. |
| Data | Destructive or irreversible database operations, destructive migrations, bulk deletes. First explain what changes, why, the risks, reversibility, testing, deployment order, rollback limits, backfills, locking, and recovery. Do not keep old contracts only for mixed-version compatibility unless a deployment requirement demands it. |
| Dependencies | Adding, removing, upgrading, or downgrading a dependency when it can materially affect the package. Never upgrade just because a newer version exists. |
| Architecture and public API | Significant architecture changes, or changes to public APIs, types, exports, entry points, data models, or documented event and lifecycle semantics. Explain why, the alternatives, and the risks. |
| CI/CD and release | Significant changes to pipelines, deployment, containers, build, or release automation. Never change them to make a local task easier. |
| Destructive commands | Deleting files or branches, reset or discard, rewriting history, force-pushing, overwriting many files. |
| Git and remotes | Commits, branches, pushes, pull requests, issues, tags, and merges: only when the user asks for that action. |
| External systems | Anything with real-world effects: emails, customer records, creating or deleting external resources, SaaS configuration, external jobs, purchases. Prefer sandboxes and mocks. |
| Scope and cost | When blocked on information or permissions, when more authority or scope is needed, or when time, cost, or usage materially exceeds what the request implied or a limit the user set. |

Approval covers the defined action: do not re-ask at every step, but ask again if the action, target, data, access, cost, or risk materially changes, or if approval is withdrawn. Approval to prepare a change does not authorize publishing, merging, deploying, or unrelated external actions. Follow any tool's own confirmation prompts. On long tasks, give brief progress updates; do not stop merely because time has passed.

### 8. Remote repository writes

1. Look up the default branch from repository metadata (read-only); do not infer it from convention or another repository.
2. Unless the user explicitly asks for a direct default-branch write, create or verify a dedicated task branch at the intended base before the first write. A small or docs-only change is not an exception. Check whether a branch exists with read-only lookups. Never use a write to probe, and never create probe, placeholder, or diagnostic commits or files.
3. Name the repository and task branch explicitly on every write; never rely on a tool's default branch. Confirm both match the task before each write, and confirm the returned commit or PR head afterwards.
4. If branch creation or verification fails, stop writing and diagnose. Never fall back to the default branch.
5. Open pull requests from the task branch. Merging requires separate authorization.
6. After an accidental default-branch write: stop writing, disclose it immediately, keep the intended work on a task branch, and restore the default branch with a forward commit that reverses only that change. Do not force-push, reset, or rewrite history unless explicitly authorized. Verify the restoration before continuing.

Never force-push, rewrite shared history, delete remote branches, merge releases, create production tags, discard uncommitted work, or reset another developer's changes without explicit approval.

### 9. Compatibility and versioning

- Preserve backward compatibility for the documented public API and established observable behavior from the current release line forward. Without explicit approval and a deliberate Semantic Versioning plan, do not remove or rename public members, narrow accepted signatures, change entry points, or alter documented event or lifecycle semantics. Prefer additive or internal fixes. Do not add aliases, deprecation shims, adapters, or fallback paths automatically; when compatibility genuinely requires one, document the rationale, tests, migration path, and removal policy before implementing it.
- Identify breaking changes before implementing them and document the migration. Use only platform features supported by the documented runtimes and browsers, or ones with an established fallback.
- Follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html): PATCH for compatible fixes, MINOR for compatible additions or deprecations, MAJOR for incompatible changes. Public types, exports, runtime requirements, configuration, and generated templates are compatibility surfaces. Explain the release impact; do not infer it from diff size. Never replace a released version's contents.
- Change versions only when asked or required by the release workflow; docs-only work does not need a bump. Keep manifests, lockfile, release notes, and compatibility docs consistent, preserve historical version references, and use the existing release tooling.
- Package versions are not deployment asset labels. Do not synchronize independently versioned packages or upgrade consumers automatically. Tagging, publishing, merging, and deploying each need their own authorization.

### 10. Accessibility and search

- UI-affecting changes target **WCAG 2.2 AA**:
  - semantic HTML, landmarks, headings, lists, tables, and forms;
  - full keyboard operation, with visible, logically ordered, unobscured focus;
  - programmatic names, instructions, errors, status announcements, and text alternatives;
  - contrast, reflow, zoom, motion, target size, and non-pointer input;
  - native controls before ARIA.
- Run the repository's automated checks and list the manual checks still needed. Never claim conformance from automation alone.
- Keep public content indexable:
  - meaningful initial HTML and crawlable links;
  - accurate, unique titles, descriptions, canonical URLs, headings, robots directives, and structured data;
  - pages internally linked and included in the sitemap;
  - no public content hidden behind JavaScript, client routing, robots rules, `noindex`, or authentication.
- Intentionally private or excluded content gets an explicit, documented indexing policy.

### 11. Report

Summarize:

- what changed and which files;
- each check run and its result (lint, types, tests, coverage, build, audit);
- what was and was not verified;
- the assumptions made;
- remaining concerns.

If an item that applies was not done, say so and why; do not imply completion.

### 12. When rules conflict

Safety → user intent and control → correctness → security and privacy → evidence over assumptions → preserving existing work → preserving existing functionality → reuse → minimal scope → project conventions → testing and verification → maintainability → efficiency.
