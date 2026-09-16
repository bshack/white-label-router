# white-label-router source instructions

These instructions are more specific than the repository-root agent guide for files under `src/`.

## Router 6 public contract

- Preserve real links and progressive enhancement. Modified clicks, non-left clicks, downloads, alternate targets, and cross-origin URLs remain native browser behavior.
- Treat incremental adoption inside existing server-rendered, CMS, and commerce applications as a first-class use case. Router must be able to enhance one owned region without requiring control of the whole page.
- `navigationRoot` owns progressive-link click interception. It defaults to document-wide behavior, can be a `Document` or `Element`, and must move an active click listener cleanly when reassigned. Do not conflate it with `router.scope`, which is the value passed to route callbacks.
- Multiple independently owned routers may coexist when their navigation roots do not overlap. Do not introduce application-global assumptions that make a single Router instance or document-wide interception mandatory.
- Route matching uses complete path boundaries and the longest matching **own** route-table prefix. Do not make behavior depend on object insertion order or inherited properties.
- Rejected navigation is atomic from Router’s perspective. Cross-origin browser targets, failed guards, and routes without runnable view behavior must not destroy the current route, push history, or replace the last successful URL/route/location state.
- Validate the destination guard and runnable view behavior before tearing down the previous route. On successful transitions, previous `destroy()` runs before next `initialize()`.
- `router.mediator` is structurally EventTarget-compatible. When it changes while listeners are active, move the owned `router:navigate` subscription from the old mediator to the new one.
- Router does not import Mediator or own authentication policy, application state, rendering implementation, data loading, or server infrastructure. Do not add framework-, CMS-, commerce-, or cloud-specific adapters to the core package when the standards-based boundary is sufficient.
- Keep browser-only title/focus/history effects out of the DOM-free server path.

## Verification

Run lint, build/type checks, runtime tests, 100% per-file coverage, audit, packed-package, npm/Yarn/pnpm, and minimum-Node checks. Do not weaken atomic-navigation, scoped-navigation, or listener-ownership tests to satisfy an implementation change.
