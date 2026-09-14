# white-label-router

> Turn URLs into application intent without hiding the web platform.

`white-label-router` is a framework-independent TypeScript router for browser and server applications. It progressively enhances real links with the History API in the browser and dispatches explicit request URLs on the server through the same matching, guard, lifecycle, query, focus, and mediator contracts.

[Documentation](https://whitelabeljs.org/docs/router/) · [API reference](https://whitelabeljs.org/api/#router) · [Demo site](https://whitelabeljs.org/)

**Responsibility:** translate navigation into application intent. Nothing more.

## Why it exists

White Label keeps URLs, links, history, and server requests visible rather than replacing them with a proprietary navigation model. Router adds the application boundary around those platform primitives while preserving normal browser behavior whenever enhancement does not apply.

Use it independently or compose it with the rest of White Label:

- [`white-label-mediator`](https://github.com/bshack/white-label-mediator) can publish `router:navigate` intent.
- [`white-label-model`](https://github.com/bshack/white-label-model) can own state changed by a route.
- [`white-label-view`](https://github.com/bshack/white-label-view) can own the rendering lifecycle started by a route.
- [`generator-white-label`](https://github.com/bshack/white-label) demonstrates the complete composition.

The package has no runtime dependency on the other White Label packages.

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

The same entrypoint is used in browsers and servers:

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

// initialize() dispatches the current URL and returns the router for chaining.
router.initialize();
```

### Server

Pass the request URL explicitly. No `window` or `document` is required:

```js
const router = new Router();
router.routes = {
    '/products': (_scope, location) => console.log(location.data.url),
    defaultRoute: () => true
};
router.initialize('/products/42?color=blue');
```

Browser-only history, click interception, focus, and document-title effects are skipped on the server. Scope mutable routing state per request when appropriate.

## Progressive enhancement first

Public navigation should remain a real link:

```html
<a href="/products/42" data-pushstate>View product 42</a>
```

`data-pushstate` opts the link into client-side enhancement. Links without it retain native behavior. Modified clicks, non-left clicks, downloads, alternate targets, and cross-origin URLs also remain native.

This preserves keyboard behavior, context menus, no-JavaScript navigation, and crawler discovery. Public routes should have directly requestable URLs that return meaningful HTML and appropriate title, description, canonical, and robots metadata.

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
            // Guards must return exactly true to allow navigation.
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

`secure()` must return exactly `true` to allow navigation. On a successful route change, the previous route's `destroy()` runs before the next route's `initialize()`.

## Matching

Routes match complete path boundaries. `/products` matches `/products` and `/products/42`, but not `/products-old`.

When multiple route prefixes match, Router selects the **longest matching route**, so specific routes win without depending on object insertion order:

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

`data.url` contains path segments after the matched prefix, `data.query` contains parsed query values, and `data.mediator` contains navigation data supplied programmatically or through the mediator. Values are URI-decoded with standard WHATWG URL APIs; applications must still validate untrusted values.

## Programmatic navigation

```js
const result = router.navigate('/products/42', {
    source: 'featured-products'
});

// `result` is the router on success or false when navigation is rejected.
```

In browsers, successful navigation updates history unless the call represents `popstate`. On servers it dispatches without History API effects.

Calling `navigate()` without a URL dispatches the current browser URL. In a non-browser runtime the safe default is `/`; server applications should normally supply the request URL explicitly.

## Mediator integration

Assign any EventEmitter-compatible mediator that provides `on()` and `removeListener()`:

```js
import Mediator from 'white-label-mediator';

const mediator = new Mediator();
const router = new Router();

router.mediator = mediator;
router.initialize();

mediator.emit('router:navigate', {
    url: '/account',
    reason: 'Session refreshed'
});
```

The complete event object becomes `location.data.mediator`. `destroy()` removes listeners owned by Router. Repeated listener initialization is idempotent.

## Public API

| Member | Behavior | Returns |
| --- | --- | --- |
| `routes` | Ordered route table of functions or lifecycle route objects. | Configuration property; not a method. |
| `scope` | Application scope passed to route callbacks. | Configuration property; not a method. |
| `mediator` | Optional EventEmitter-compatible source for `router:navigate`. | Configuration property; not a method. |
| `initialize(url?)` | Dispatch the browser URL or an explicit server URL and attach applicable listeners. | The same `Router` instance. |
| `navigate(url?, data?, isPopState?)` | Match and run a route; update browser history when appropriate. | The same `Router` instance on success; `false` for cross-origin browser URLs, rejected guards, or routes without runnable view behavior. |
| `addListeners()` | Attach browser and optional mediator listeners once. | The same `Router` instance. |
| `removeListeners()` | Release listeners owned by this router. | The same `Router` instance. |
| `destroy()` | Release routing listeners. | The same `Router` instance after cleanup. |
| `parseQueryString(query)` | Decode a query string using `URLSearchParams`. | A plain object containing the last value for each query key. |
| `setLocationData(data?)` | Rebuild the current route location payload. | `undefined`; updates `locationData` in place. |
| `applyPageContext(route)` | Update route title/focus context when applicable. | The same `Router` instance. |
| `eventPushStateClick(event)` | Handle an eligible browser push-state click. | The same `Router` instance after handled navigation; `true` when native/default handling should continue. |
| `eventPopState()` | Dispatch the current browser history location. | The same `Router` instance. |

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

Initialization dispatches the current URL without adding a duplicate history entry. Back/forward navigation reads `window.location`—including path, query, and hash—even when history state is null or belongs to another application. History state is not treated as the authoritative URL.

## TypeScript

Implementation uses strict TypeScript and emits JavaScript, source maps, and declarations into `dist`.

```ts
const router = new Router();
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

Tests cover browser behavior, DOM-free server routing, and parity of the shared route contract. Coverage enforces 100% statements, branches, functions, and lines per implementation file. CI builds authored source, uploads generated artifacts for inspection, audits dependencies, packs the package, and verifies the packed public API across npm, Yarn, and pnpm.

Edit `src/*.ts` and regenerate `dist`; do not edit generated files directly.

## Design boundary

Router owns URL-to-intent translation. It intentionally does not own application state, rendering, data loading, authentication policy, or server infrastructure. Real links and server URLs remain the foundation; Router enhances them instead of replacing them.
