# white-label-router

> Turn URLs into application intent without hiding the web platform.

`white-label-router` is a framework-independent TypeScript router for browser and server applications. It progressively enhances real links with the History API in the browser and dispatches explicit request URLs on the server through the same matching, guard, lifecycle, query, focus, and mediator contracts.

[Documentation](https://whitelabeljs.org/docs/router/) · [API reference](https://whitelabeljs.org/api/#router) · [Demo site](https://whitelabeljs.org/)

**Responsibility:** translate navigation into application intent. Nothing more.

## Why it exists

White Label keeps URLs, links, history, and server requests visible rather than replacing them with a proprietary navigation model. Router adds an application boundary around those platform primitives while preserving normal browser behavior whenever enhancement does not apply.

Use it independently or compose it with the rest of White Label:

- [`white-label-mediator`](https://github.com/bshack/white-label-mediator) can publish `router:navigate` intent.
- [`white-label-model`](https://github.com/bshack/white-label-model) can own state changed by a route.
- [`white-label-view`](https://github.com/bshack/white-label-view) can own the rendering lifecycle started by a route.
- [`generator-white-label`](https://github.com/bshack/white-label) demonstrates the complete composition.

The package has no runtime dependency on the other White Label packages.

## Where it fits

Router is especially useful when URL-backed behavior should be added **without turning the whole page into a client-side application**. Typical fits include progressively enhanced public sites, server-rendered applications, commerce/CMS frontends, account areas, search/filter experiences, and existing applications being modernized one region at a time.

For incremental adoption, `navigationRoot` can limit link interception to one owned DOM region while the rest of the page keeps its existing navigation behavior. This makes it possible for multiple independently owned enhancements to coexist without requiring one document-wide router.

Router is not a replacement for server routes, authentication/authorization, CDN or API-gateway routing, or a backend framework. Highly client-owned applications can still use it, but its strongest advantage is preserving real links and server-requestable URLs while adding client behavior selectively.

See the [incremental server-rendered application guide](https://whitelabeljs.org/guides/incremental-javascript-for-server-rendered-apps/) for the broader integration pattern.

## Requirements

- Node.js `^22.18.0` or `>=24.11.0` for installation, development, and server execution.
- npm, Yarn, and pnpm are supported for installation; see [`PACKAGE_MANAGERS.md`](PACKAGE_MANAGERS.md).
- Browser History API, location, and standard DOM events only when using browser navigation behavior.
- A directly requestable server route for every public browser route so enhanced links remain meaningful without JavaScript.

## Install

```sh
npm install white-label-router
# or: yarn add white-label-router
# or: pnpm add white-label-router
```

```js
import Router from 'white-label-router';
```

## One route contract, two runtimes

### Browser

Omit the URL to dispatch the current browser location and attach browser navigation listeners:

```js
const router = new Router();
router.routes = {
    '/products': (_scope, location) => console.log(location.data.url),
    defaultRoute: () => true
};
router.initialize();
```

### Server

Pass a fully qualified request URL when possible. No `window` or `document` is required:

```js
const router = new Router();
router.routes = {
    '/products': (_scope, location) => console.log(location.data.url),
    defaultRoute: () => true
};
router.initialize('https://example.com/products/42?color=blue');
```

Browser-only history, click interception, focus, and document-title effects are skipped on the server. Scope mutable routing state per request when appropriate. If a host exposes only a raw relative HTTP request target, preserve that target's path semantics at the adapter boundary before handing Router an absolute URL; see [Serverless and function runtimes](#serverless-and-function-runtimes).

## Progressive enhancement first

Public navigation should remain a real link:

```html
<a href="/products/42" data-pushstate>View product 42</a>
```

`data-pushstate` opts the link into client-side enhancement. Router intercepts a click on an `<a href data-pushstate>` (HTML or SVG; Router reads the `href` attribute, resolved against `document.baseURI`) only when it can actually handle it. These clicks stay native:

- links without `data-pushstate`, or clicks whose default action was already prevented;
- non-left clicks and clicks with Meta, Ctrl, Shift, or Alt held;
- links with `download`, or a `target` other than `_self`;
- cross-origin or unparseable URLs;
- URLs that match no route, or only the placeholder `defaultRoute` the constructor installs (a `defaultRoute` you configure yourself does intercept unmatched links);
- routes with no runnable view behavior;
- links whose guard returns anything but `true`, or throws (the guard's error still propagates).

Once a route has been committed, the click's default action is cancelled even if the route's view throws, so the browser does not navigate a second time.

This preserves keyboard behavior, context menus, no-JavaScript navigation, and crawler discovery. Public routes should have directly requestable URLs that return meaningful HTML and appropriate title, description, canonical, and robots metadata.

### Scope enhancement to one existing region

By default, Router listens for opted-in links across `document`. Existing server-rendered/CMS/commerce applications can constrain that ownership:

```js
const router = new Router();
router.navigationRoot = document.querySelector('[data-product-refinements]');
router.routes = {
    '/search': (_scope, location) => {
        applyFilters(location.data.query);
    }
};
router.initialize();
```

Only click events that reach `navigationRoot` are considered by that Router. Links elsewhere on the page keep the host application's behavior. Reassigning `navigationRoot` while listeners are active moves the owned click listener to the new root. Setting it to `null` restores document-wide interception.

`navigationRoot` is deliberately separate from `scope`: `navigationRoot` controls where enhanced-link clicks are observed; `scope` is application data passed to route callbacks.

## Define routes

A route can be a function:

```js
router.routes = {
    '/help': (scope, location) => {
        scope.textContent = `Help page: ${location.url}`;
    }
};
```

Or an object describing route lifecycle:

```js
router.routes = {
    '/orders': {
        title: 'Orders',
        focus: '#orders-title',
        secure(scope, location) {
            return Boolean(window.currentUser);
        },
        view: {
            initialize(scope, location) {
                scope.textContent = 'Order history';
            },
            destroy(scope, nextLocation) {
                scope.replaceChildren();
            }
        }
    }
};
```

### Guards

`secure(scope, location)` runs synchronously with the destination location, before anything is torn down. It must return exactly `true` to allow navigation; any other value (including a Promise) rejects it and `navigate()` returns `false`. An error thrown by a guard propagates to the caller and leaves Router state unchanged. Client guards are interface behavior, not server authorization.

### Lifecycle order

A successful navigation runs these steps in order:

1. Match the route and run its guard. Rejection stops here with no state change.
2. Commit `router.url`, `router.route`, and `router.locationData` for the destination.
3. Call the previous route's `destroy(scope, nextLocation)`, if it had one.
4. Run the new route: a function route, a `view` function, or `view.initialize(scope, location)`.
5. Apply the route's title and focus (browser only; see [Title and focus](#title-and-focus)).
6. Set `router.previousRoute`, then push a history entry (browser only; skipped for `initialize()` and back/forward).

Router keeps the `destroy` callback of the lifecycle that actually initialized, so replacing or mutating the route table later does not change which teardown runs. That lifecycle stays owned even if `initialize()` throws, or title/focus work throws after it: the route remains committed, the error is rethrown to the caller, and its `destroy()` still runs before the next successful route starts. Title, focus, and history are skipped for a route whose `initialize()` threw.

### Navigating from inside a route

`navigate()` is re-entrant. If `initialize()`, `destroy()`, a focus handler, or a mediator event starts another navigation, the newer navigation wins: the outer one stops at that point, applies no title, focus, or history of its own, and returns the router. For example, navigating to `/two` from inside `/one`'s `initialize()` runs `/one`'s `destroy()` and then `/two`'s `initialize()`, and leaves `/two` as the active route.

## Matching

Routes match complete path boundaries. `/products` matches `/products` and `/products/42`, but not `/products-old`.

When multiple route prefixes match, Router selects the **longest matching route**, so specific routes win without depending on object insertion order. Only own route-table properties participate in matching. If nothing matches and no own `defaultRoute` is configured, navigation is rejected; in browser click interception the real link remains native.

```js
router.routes = {
    '/products': productsRoute,
    '/products/sale': saleRoute,
    defaultRoute
};
```

`/products/sale` selects `saleRoute` even though `/products` was defined first. When no prefix matches, `defaultRoute` runs if configured.

Route keys are encoded the same way URL parsing encodes paths, so `'/café'` matches a request for `/caf%C3%A9`. Keys that don't start with `/`, or that contain `?` or `#`, can never match a pathname and are ignored (apart from `defaultRoute`). If two keys normalize to the same path (for example `/x/../same` and `/same`), the key already in normalized form wins, otherwise the alphabetically lowest; insertion order never decides.

A new `Router` starts with a placeholder `defaultRoute` that does nothing, so programmatic navigation to an unmatched URL succeeds until you replace `routes`. That placeholder never intercepts link clicks.

## Location contract

Routes receive the configured `scope` and a location object:

```js
{
    url: '/products/42?color=blue',
    data: {
        url: ['42'],
        mediator: {source: 'featured-products'},
        query: {color: 'blue'}
    }
}
```

- `url` is the path, query, and hash (`/products/42?color=blue#reviews`), never a full absolute URL. This holds on the server too: `initialize('https://example.com/products/42?color=blue')` produces `url: '/products/42?color=blue'`. `router.url` holds the same value.
- `data.url` contains the URI-decoded path segments after the matched route prefix (all segments for `defaultRoute`). A segment with malformed percent-encoding is passed through undecoded.
- `data.query` contains query values decoded with `URLSearchParams`; for duplicate keys the last value wins.
- `data.mediator` contains navigation data passed to `navigate()` or through `CustomEvent.detail`. It is `{}` for link clicks, `initialize()`, and back/forward, and `undefined` when `navigate()` is called without data.

Applications must still validate these untrusted values.

## Programmatic navigation

```js
const result = router.navigate('/products/42', {
    source: 'featured-products'
});
```

In browsers, successful navigation updates history unless the call represents `popstate`. On servers it dispatches without History API effects.

Rejected navigation is atomic from Router's perspective: malformed or wrong-type URL candidates, cross-origin browser URLs, URLs with no matching route/default route, failed guards, and routes without runnable view behavior return `false` without destroying the current route, pushing browser history, or replacing the last successful URL, selected route, or location payload.

Calling `navigate()` without a URL re-runs Router's last committed URL. Before anything has been committed it uses the current browser URL, or `/` on a server; server applications should normally supply a fully qualified request URL explicitly. Errors thrown by a guard or a route callback propagate out of `navigate()`.

## Mediator integration

Assign any standards-based event target that provides `addEventListener()` and `removeEventListener()`. `white-label-mediator` is the first-party implementation:

```js
import Mediator from 'white-label-mediator';

const mediator = new Mediator();
const router = new Router();
router.mediator = mediator;
router.initialize();

mediator.dispatchEvent(new CustomEvent('router:navigate', {
    detail: {
        url: '/account',
        reason: 'Session refreshed'
    }
}));
```

The `CustomEvent.detail` object becomes `location.data.mediator`, and its `url` (if any) is the destination. A detail without `url`, or a `null`/missing detail, re-runs the current URL; a detail that is not a plain object (a string, number, or array) is ignored. Mediator navigations push browser history like `navigate()`. `destroy()` removes the listener owned by Router. Repeated listener initialization is idempotent. Reassigning `router.mediator` while listeners are active moves the `router:navigate` subscription to the replacement.

Router does not import or require `white-label-mediator`; the integration is structural so another compatible EventTarget can be used instead.

## Serverless and function runtimes

Pass the incoming request URL explicitly when Router runs inside a serverless function. A Web `Request` already supplies a fully qualified URL, so preserve it directly:

```js
const router = new Router();
router.routes = routes;
router.initialize(request.url);
```

Do not parse that absolute URL and rebuild it from `pathname + search`; a pathname beginning `//` can change meaning when reparsed.

Some Node HTTP frameworks expose only a raw origin-form request target such as `/products/42?color=blue`. Prefix that raw target with the application's configured origin without feeding the target through `new URL(raw, origin)` first:

```js
const applicationOrigin = 'https://example.com';
router.initialize(`${applicationOrigin}${req.originalUrl}`);
```

This assumes the adapter's raw request target begins with `/`. If a host can also supply absolute-form request targets, detect and preserve those separately. A raw target beginning `//` is a path in HTTP origin-form but a network-path reference to WHATWG `URL`; handing `//...` directly to Router as a relative URL changes its meaning.

Create a request-scoped Router when its location state, mediator, route lifecycle, or other mutable configuration belongs to one invocation. Warm function processes may serve sequential or overlapping requests, so sharing one mutable Router can mix location/lifecycle state unless that process-wide lifetime is intentional.

Router handles **application routing inside the invocation**. It does not replace API Gateway routes, CDN routing, Vercel/Netlify/Cloudflare route configuration, load balancing, authentication infrastructure, or other cloud request plumbing.

The package currently documents Node.js as its supported server runtime. Its DOM-free server path uses standard URL APIs, but that is not a blanket compatibility claim for every edge provider; verify the actual target runtime before deployment.

## Title and focus

Object routes can define browser title and focus behavior:

```js
router.routes = {
    '/account': {
        title: 'Account',
        focus: '#account-title',
        view: renderAccount
    }
};
```

After a route renders, Router sets `document.title` from `title` and focuses the first element matching `focus` (default `main h1`), adding `tabindex="-1"` if the element has no `tabindex`. Set `focus: false` for an in-page refinement that should preserve current focus. The first dispatch from `initialize()` sets the title but does not move focus, because the browser already owns focus on a freshly loaded page; later navigations do. Server runtimes retain `pageTitle` as route state but do not mutate a document or focus target.

## Browser history behavior

Initialization dispatches the current URL without adding a duplicate history entry. Back/forward navigation reads `window.location`—including path, query, and hash—even when history state is null or belongs to another application. History state is not treated as the authoritative URL. Rejected navigation does not add a history entry.

When back/forward changes only the hash (footnotes, skip links), Router updates `router.url` and `locationData.url` but does not re-run the route, call `destroy()`, or move focus. A change to the path or query re-runs the route as usual.

## Public API

| Member | Behavior | Returns |
| --- | --- | --- |
| `routes` | Route table of functions or lifecycle route objects; matching uses the longest own path prefix, not insertion order. | Configuration property. |
| `scope` | Application scope passed to route callbacks. | Configuration property. |
| `navigationRoot` | Optional browser `Document`/`Element` that owns `data-pushstate` click interception; `null` uses `document`. Active listeners move when reassigned. | Configuration property. |
| `mediator` | Optional EventTarget-compatible source for `router:navigate`; active subscriptions move when this property changes. | Configuration property. |
| `initialize(url?)` | Dispatch the browser URL or an explicit server URL and attach applicable listeners. | The same `Router` instance. |
| `navigate(url?, data?, isPopState?)` | Match and run a route; update browser history when appropriate. Invalid/malformed URL candidates and other rejected navigation preserve current route state. | The same Router on success; `false` for rejected navigation. |
| `addListeners()` | Attach browser and optional mediator listeners once. | The same `Router` instance. |
| `removeListeners()` | Release listeners owned by this router. | The same `Router` instance. |
| `destroy()` | Release routing listeners. Does not call the active route's `destroy()`. | The same `Router` instance after cleanup. |
| `parseQueryString(query)` | Decode a query string using `URLSearchParams`. | A plain object containing the last value for each query key. |
| `setLocationData(data?)` | Rebuild the current route location payload. | `undefined`; updates `locationData` in place. |
| `applyPageContext(route)` | Update route title/focus context when applicable. | The same `Router` instance. |
| `eventPushStateClick(event)` | Handle an eligible browser push-state click (see [Progressive enhancement first](#progressive-enhancement-first)). | The same Router after handled navigation; `true` when native/default handling should continue. |
| `eventPopState()` | Dispatch the current browser history location; a hash-only change just updates `url`. | The same `Router` instance. |

Router records navigation state on public properties that applications should treat as read-only: `url`, `route`, `previousRoute`, `locationData`, and `pageTitle`.

## TypeScript

Implementation uses strict TypeScript and emits JavaScript, source maps, and declarations into `dist`.

```ts
const router = new Router();
router.navigationRoot = document.querySelector('main');
const greeting: Router.Route = (scope, location) => {
    console.log(location.data.query.name);
};
router.routes['/hello'] = greeting;
router.initialize();
```

`Router.Route`, `Router.Location`, `Router.Navigation`, and `Router.Handler` expose the supported contracts. Browser DOM types are present because the same class supports browser scopes and events; server hosts do not need DOM globals at runtime.

## Development

```sh
npm ci --ignore-scripts
npm run lint && npm run coverage && npm run audit
```

`npm run coverage` builds (which typechecks), runs the consumer type checks, and runs every Node test, so `npm run typecheck` and `npm test` don't need separate runs. For a quick loop while iterating, use `npm run build && node --test test/<file>.test.js`. The build rewrites the tracked `dist/`.

Tests cover browser behavior, scoped progressive navigation, DOM-free server routing, atomic rejected navigation, mediator reassignment, and parity of the shared route contract. Coverage enforces 100% statements, branches, functions, and lines per implementation file. CI verifies the documented Node minimum and primary Node line, audits dependencies, packs the package, and verifies the public API across npm, Yarn, and pnpm.

Edit `src/index.ts` and regenerate `dist`; do not edit generated files directly. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Design boundary

Router owns URL-to-intent translation. It intentionally does not own application state, rendering, data loading, authentication policy, or server infrastructure. Real links and server URLs remain the foundation; Router enhances them instead of replacing them.
