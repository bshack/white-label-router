# white-label-router source instructions

These instructions are more specific than the repository-root agent guide for files under `src/`.

## Router 6 public contract

- Preserve real links and progressive enhancement. Modified clicks, non-left clicks, downloads, alternate targets, and cross-origin URLs remain native browser behavior.
- Route matching uses complete path boundaries and the longest matching **own** route-table prefix. Do not make behavior depend on object insertion order or inherited properties.
- Rejected navigation is atomic from Router’s perspective. Cross-origin browser targets, failed guards, and routes without runnable view behavior must not destroy the current route, push history, or replace the last successful URL/route/location state.
- Validate the destination guard and runnable view behavior before tearing down the previous route. On successful transitions, previous `destroy()` runs before next `initialize()`.
- `router.mediator` is structurally EventTarget-compatible. When it changes while listeners are active, move the owned `router:navigate` subscription from the old mediator to the new one.
- Router does not import Mediator or own authentication policy, application state, rendering implementation, data loading, or server infrastructure.
- Keep browser-only title/focus/history effects out of the DOM-free server path.

## Verification

Run lint, build/type checks, runtime tests, 100% per-file coverage, audit, packed-package, npm/Yarn/pnpm, and minimum-Node checks. Do not weaken atomic-navigation or listener-ownership tests to satisfy an implementation change.
