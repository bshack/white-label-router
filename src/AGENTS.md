# white-label-router source instructions

These instructions are more specific than the repository-root agent guide for files under `src/`.

## Router 6 public contract

- Preserve real links and progressive enhancement. Modified clicks, non-left clicks, downloads, alternate targets, and cross-origin URLs remain native browser behavior.
- Treat incremental adoption inside existing server-rendered, CMS, and commerce applications as a first-class use case. Router must be able to enhance one owned region without requiring control of the whole page.
- `navigationRoot` owns progressive-link click interception. It defaults to document-wide behavior, can be a `Document` or `Element`, and must move an active click listener cleanly when reassigned. Do not conflate it with `router.scope`, which is the value passed to route callbacks.
- Multiple independently owned routers may coexist when their navigation roots do not overlap. Do not introduce application-global assumptions that make a single Router instance or document-wide interception mandatory.
- Route matching uses complete path boundaries and the longest matching **own** route-table prefix. Do not make behavior depend on object insertion order or inherited properties.
- Rejected navigation is atomic from Router’s perspective. Cross-origin browser targets, failed guards, and routes without runnable view behavior must not destroy the current route, push history, or replace the last successful URL/route/location state.
- Validate the destination guard and runnable view behavior before tearing down the previous route. On successful transitions: commit `url`/`route`/`locationData` → previous `destroy()` → next `initialize()` → title/focus → `previousRoute` → `pushState`.
- `navigate()` is re-entrant. A navigation started from `initialize()`, `destroy()`, focus, or a mediator event supersedes the outer one (tracked by `navigationToken`); the outer call stops committing and returns the router. Destroy ownership is released before `destroy()` is called so it never runs twice.
- A throwing `initialize()` (or title/focus) leaves the route committed and its `destroy()` owned; the error is rethrown. Guards run before any commit; a throwing guard changes no state.
- Click interception falls back to native when the URL matches no route or only the constructor's placeholder `defaultRoute` (tracked in `builtInDefaultRoutes`), the route is not runnable, or the guard rejects or throws. Read `href` via `getAttribute` (SVG links). Call `preventDefault()` once a navigation has committed, even if the view throws.
- `url` and `location.url` are always path + query + hash, in both runtimes. Route keys are WHATWG-path-encoded (`normalizeRouteKey`) and compiled into a prefix map rebuilt only when the own key list changes; matching must not depend on insertion order.
- Fragment-only `popstate` updates `url`/`locationData.url` without re-running the route. The initial `initialize()` dispatch never moves focus.
- `router.mediator` is structurally EventTarget-compatible. When it changes while listeners are active, move the owned `router:navigate` subscription from the old mediator to the new one.
- Router does not import Mediator or own authentication policy, application state, rendering implementation, data loading, or server infrastructure. Do not add framework-, CMS-, commerce-, or cloud-specific adapters to the core package when the standards-based boundary is sufficient.
- Keep browser-only title/focus/history effects out of the DOM-free server path.

## Verification

Run the root full gate. A source change is release-ready only once CI's packed-package, npm/Yarn/pnpm, and minimum-Node checks also pass. Never weaken atomic-navigation, scoped-navigation, or listener-ownership tests to accommodate an implementation change.
