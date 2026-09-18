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

`data-pushstate` opts the link into client-side enhancement. Links without it retain native behavior. Modified clicks, non-left clicks, downloads, alternate targets, and cross-origin URLs also remain native.

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

`secure()` must return exactly `true` to allow navigation. Client guards are interface behavior, not server authorization. Router validates the destination guard and runnable view behavior before tearing down the current route. On a successful route change, the previous route's `destroy()` runs before the next route's `initialize()`. Router snapshots the destroy callback that belongs to the lifecycle that actually initialized, so later replacement or mutation of the route table does not retarget teardown. The destroy callback receives the incoming location as `nextLocation`. If browser title/focus work throws after a route has initialized, that initialized lifecycle remains owned and is still torn down before a later successful route starts.

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

`data.url` contains path segments after the matched prefix, `data.query` contains parsed query values, and `data.mediator` contains navigation data supplied programmatically or through `CustomEvent.detail`. Values are URI-decoded with standard WHATWG URL APIs; applications must still validate untrusted values.

## Programmatic navigation

```js
const result = router.navigate('/products/42', {
    source: 'featured-products'
});
```

In browsers, successful navigation updates history unless the call represents `popstate`. On servers it dispatches without History API effects.

Rejected navigation is atomic from Router's perspective: malformed or wrong-type URL candidates, cross-origin browser URLs, URLs with no matching route/default route, failed guards, and routes without runnable view behavior return `false` without destroying the current route, pushing browser history, or replacing the last successful URL, selected route, or location payload.

Calling `navigate()` without a URL dispatches the current browser URL. In a non-browser runtime the safe default is `/`; server applications should normally supply a fully qualified request URL explicitly.

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

The `CustomEvent.detail` value becomes `location.data.mediator`. `destroy()` removes the listener owned by Router. Repeated listener initialization is idempotent. Reassigning `router.mediator` while listeners are active moves the `router:navigate` subscription to the replacement.

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

The default focus selector is `main h1`. Set `focus: false` for an in-page refinement that should preserve current focus. Server runtimes retain `pageTitle` as route state but do not mutate a document or focus target.

## Browser history behavior

Initialization dispatches the current URL without adding a duplicate history entry. Back/forward navigation reads `window.location`—including path, query, and hash—even when history state is null or belongs to another application. History state is not treated as the authoritative URL. Rejected navigation does not add a history entry.

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
| `destroy()` | Release routing listeners. | The same `Router` instance after cleanup. |
| `parseQueryString(query)` | Decode a query string using `URLSearchParams`. | A plain object containing the last value for each query key. |
| `setLocationData(data?)` | Rebuild the current route location payload. | `undefined`; updates `locationData` in place. |
| `applyPageContext(route)` | Update route title/focus context when applicable. | The same `Router` instance. |
| `eventPushStateClick(event)` | Handle an eligible browser push-state click. | The same Router after handled navigation; `true` when native/default handling should continue. |
| `eventPopState()` | Dispatch the current browser history location. | The same `Router` instance. |

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
npm run lint
npm run typecheck
npm test
npm run coverage
npm run audit
npm pack --dry-run
```

Tests cover browser behavior, scoped progressive navigation, DOM-free server routing, atomic rejected navigation, mediator reassignment, and parity of the shared route contract. Coverage enforces 100% statements, branches, functions, and lines per implementation file. CI verifies the documented Node minimum and primary Node line, audits dependencies, packs the package, and verifies the public API across npm, Yarn, and pnpm.

Edit `src/*.ts` and regenerate `dist`; do not edit generated files directly.

## Design boundary

Router owns URL-to-intent translation. It intentionally does not own application state, rendering, data loading, authentication policy, or server infrastructure. Real links and server URLs remain the foundation; Router enhances them instead of replacing them.
