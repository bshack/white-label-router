# Contributing

Thanks for improving `white-label-router`.

## Setup

```sh
npm ci --ignore-scripts
npm run build
npm run lint
npm run typecheck
npm test
npm run coverage
npm run audit
npm pack --dry-run
```

## Pull requests

Keep changes focused and preserve the documented routing contract: real links first, History API enhancement, predictable route matching, guarded navigation, lifecycle cleanup, title/focus behavior, and mediator integration. Do not make primary navigation depend on JavaScript-only links.

Add or update tests when behavior changes. Do not weaken lint, type, coverage, or security checks. Review the complete diff for generated-file drift, credentials, private data, debugging code, and unrelated formatting changes.

Breaking public API changes require a SemVer major release rather than compatibility shims.

## Accessibility and indexing

Changes to navigation should preserve keyboard behavior, directly requestable URLs, crawlable links, and deliberate focus management. Follow `SECURITY.md` for suspected vulnerabilities.