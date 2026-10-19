# Contributing

Thanks for improving `white-label-router`.

## Setup and verification

Use Node.js `^22.18.0 || >=24.11.0` and npm 11 or later.

```sh
npm ci --ignore-scripts
npm run build && node --test test/<file>.test.js   # quick loop while iterating
npm run lint && npm run coverage && npm run audit   # full check before opening a PR
```

`npm run coverage` builds (which typechecks), runs the consumer type checks in `test-types/`, and runs every Node test with 100% coverage required per file, so `npm run typecheck` and `npm test` don't need separate runs. Lint warnings count as failures. Edit `src/index.ts`, not `dist/`; the build rewrites the tracked `dist/`, so restore it (`git checkout -- dist`) unless your change needs regenerated output.

## Pull requests

Keep changes focused and preserve the documented routing contract: real links first, History API enhancement, predictable route matching, guarded navigation, lifecycle cleanup, title/focus behavior, and mediator integration. Do not make primary navigation depend on JavaScript-only links.

Add or update tests when behavior changes. Do not weaken lint, type, coverage, or security checks. Review the complete diff for generated-file drift, credentials, private data, debugging code, and unrelated formatting changes.

Breaking public API changes require a SemVer major release rather than compatibility shims.

## Accessibility and indexing

Changes to navigation should preserve keyboard behavior, directly requestable URLs, crawlable links, and deliberate focus management. Follow `SECURITY.md` for suspected vulnerabilities.
