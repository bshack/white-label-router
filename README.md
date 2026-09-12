# white-label-router

`white-label-router` is a small browser/server router with one route contract across both runtimes. In browsers it progressively enhances real links with the History API, intercepts eligible links marked with `data-pushstate`, handles back/forward navigation, and manages title/focus context. In Node.js or another non-DOM runtime it dispatches explicit request URLs through the same route, guard, lifecycle, query, and mediator contracts without requiring `window` or `document`.

## Requirements

- Node.js `^22.18.0` or `>=24.11.0` for installation, development, and server execution.
- A browser environment with `window.history`, `window.location`, and standard DOM events only when using browser navigation behavior.
- A directly requestable server route for every public browser route so progressive links remain meaningful without client JavaScript.

## Accessibility and indexability

Use real `<a href="...">` links and add `data-pushstate` only as progressive enhancement. This preserves keyboard behavior, context-menu actions, no-JavaScript navigation, and crawler discovery. Every public route needs a directly requestable URL that returns meaningful HTML, a unique title and description, a canonical URL, and the correct robots policy.

Client-side route changes should manage document title and focus deliberately. Avoid moving focus for same-page refinements unless the interaction requires it. Server routing has no DOM/focus side effects; those remain browser responsibilities.

## Versioning policy

Backward compatibility is not maintained through sentinel arguments, optional adapter methods, aliases, or runtime fallbacks. Breaking public API changes are communicated with a Semantic Versioning major release and release notes outside this README.

## Install and import

```sh
npm install white-label-router
```

The same package entrypoint is used in browsers and servers:

```js
import Router from 'white-label-router';
```

### Browser and server initialization

In a browser, omit the URL to dispatch `window.location` and register browser navigation listeners:

```js
const router = new Router();
router.routes = {
    '/products': (_scope, location) => console.log(location.data.url),
    defaultRoute: () => true
};
router.initialize();
```

On a server, pass the request URL explicitly. No browser globals are required and History API/focus behavior is skipped:

```js
const router = new Router();
router.routes = {
    '/products': (_scope, location) => console.log(location.data.url),
    defaultRoute: () => true
};
router.initialize('/products/42?color=blue');
```

Create a router per request, or otherwise scope mutable routing state to the intended request/application lifetime.

## Complete browser example

```js
import Router from 'white-label-router';

class ApplicationRouter extends Router {
    constructor() {
        super();

        this.scope = document.querySelector('main');
        this.routes = {
            '/products': (scope, location) => {
                scope.textContent = `Product: ${location.data.url[0] || 'all'}`;
            },
            '/account': {
                title: 'Your account',
                secure: () => Boolean(window.currentUser),
                view: {
                    initialize: (scope, location) => {
                        scope.textContent = 'Account';
                        console.log(location.data.query);
                    },
                    destroy: () => {
                        console.log('Leaving account');
                    }
                }
            },
            defaultRoute: () => {
                console.log('No configured route matched.');
            }
        };
    }
}

const router = new ApplicationRouter();
router.initialize();
```

In a browser, `initialize()` reads the current path and query string, registers document click and `popstate` listeners, and dispatches the matching route without adding a duplicate history entry. On a server, `initialize(url)` dispatches the supplied URL and only registers an optional mediator listener.

## Define routes

A route may be a function:

```js
this.routes = {
    '/help': (scope, location) => {
        scope.textContent = `Help page: ${location.url}`;
    }
};
```

Or it may describe a title, security check, focus target, and view lifecycle:

```js
this.routes = {
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

The `secure` function must return exactly `true` to allow navigation. When navigation succeeds, the previous route's `destroy()` runs before the next route's `initialize()`.

## Route matching behavior

Routes match complete path boundaries in object insertion order. For example, `/products` matches `/products` and `/products/42`, but it does not match `/products-old`. Put more specific routes before broader ones:

```js
this.routes = {
    '/products/sale': saleRoute,
    '/products': productsRoute,
    defaultRoute
};
```

If no prefix matches, `defaultRoute` is used when present.

## Navigate from HTML

The router delegates one document-level click listener in browser runtimes. Add `data-pushstate` to an anchor to use client-side navigation:

```html
<a href="/products/42" data-pushstate>
    <span>View product 42</span>
</a>
```

Clicks on nested elements are resolved to the enclosing anchor. Links without `data-pushstate` keep normal browser behavior.

Modified clicks, non-left clicks, downloads, links targeting another browsing context, and cross-origin URLs also keep normal browser behavior.

## Navigate from JavaScript

```js
router.navigate('/products/42', {
    source: 'featured-products'
});
```

The second argument becomes `location.data.mediator`. In a browser, successful navigation adds the URL to browser history unless the call represents `popstate`. On a server, navigation dispatches the route without History API effects.

Call `navigate()` without a URL, or pass `undefined`, to dispatch the browser's current URL. In a non-browser runtime the safe default is `/`; server applications should normally pass the request URL explicitly.

## Location data

Every route receives the configured `scope` and a location object:

```js
{
    url: '/products/42?color=blue',
    data: {
        url: ['42'],
        mediator: {
            source: 'featured-products'
        },
        query: {
            color: 'blue'
        }
    }
}
```

- `url` is the complete route URL.
- `data.url` contains path segments after the matched route prefix.
- `data.mediator` contains the object passed to `navigate()` or received from the mediator.
- `data.query` contains parsed query values.

Path segments and query values are URI-decoded with standard WHATWG URL APIs. Application code must still validate values before using them.

## Mediator navigation

Assign an EventEmitter-compatible mediator before initialization. It must provide both `on()` and `removeListener()` so teardown can release the subscription.

```js
import Mediator from 'white-label-mediator';

const mediator = new Mediator();
const router = new ApplicationRouter();
router.mediator = mediator;
router.initialize();

mediator.emit('router:navigate', {
    url: '/account',
    reason: 'Session refreshed'
});
```

The complete emitted object is passed to the route as `location.data.mediator`. `destroy()` removes browser and mediator listeners owned by the router. Repeated listener initialization is idempotent and does not add duplicates.

## Page title and focus

Object routes can set a title and move focus after rendering in browser runtimes:

```ts
router.routes = {
    '/account': {
        title: 'Account',
        focus: '#account-title',
        view: renderAccount
    }
};
```

The default focus selector is `main h1`. Set `focus: false` for an in-page state change that should preserve the user's current focus. A focused element receives `tabindex="-1"` only when it does not already have a tabindex. Server runtimes retain `pageTitle` as route state but do not mutate a document or focus target.

## Current navigation behavior

Browser initialization dispatches the current URL without adding a duplicate history entry. Back/forward navigation reads `window.location`, including path, query, and hash, even when history state is null or belongs to another application. History state is not treated as the authoritative URL.

Server initialization dispatches the explicit URL supplied by the host. Browser-only click interception, `popstate`, title mutation, focus, and `pushState` are deliberately skipped when DOM globals are unavailable.

## Lifecycle

| Method | Behavior |
| --- | --- |
| `initialize(url?)` | Dispatches the browser URL when omitted, or an explicit request URL in a non-browser runtime; adds the applicable listeners. |
| `navigate(url?, data?, isPopState?)` | Matches and runs a route, updates browser history when appropriate, and returns the router; returns `false` when blocked or invalid. |
| `addListeners()` | Adds browser listeners when available and the optional mediator listener once. |
| `removeListeners()` | Removes listeners previously added by this router. |
| `destroy()` | Calls `removeListeners()` and returns the router. |

Call `destroy()` when the router is no longer used:

```js
router.destroy();
```

## TypeScript

Implementation code uses strict TypeScript. Builds emit JavaScript, source maps with embedded source, and `.d.ts` declarations into `dist`. JavaScript callers can use the package without compiling TypeScript themselves.

```ts
import Router from 'white-label-router';

const router = new Router();
const greeting: Router.Route = (scope, location) => {
    console.log(location.data.query.name);
};
router.routes['/hello'] = greeting;
router.initialize();
```

`Router.Route` covers function routes and objects with a guard or view lifecycle. `Router.Location` describes decoded URL data, `Router.Navigation` describes mediator payloads, and `Router.Handler` describes a route callback. Browser DOM types are part of the declarations because the same class also supports browser scopes and events; server hosts do not need to provide DOM globals at runtime.

The distribution is CommonJS emitted by TypeScript. CommonJS `require` and the documented ESM imports are supported through normal Node or bundler interoperability. Edit `src/*.ts`, then run `npm run build`; do not edit generated `dist` files.

## Verification and coverage

The package can be installed and used independently; it has no runtime dependency on the other White Label packages. Package tests cover browser behavior, DOM-free server routing, and parity of the shared route contract. Consuming applications remain responsible for their own application-level integration testing.

```sh
npm ci --ignore-scripts
npm run lint
npm run typecheck
npm test
npm run coverage
npm run audit
npm pack --dry-run
```

`npm test` builds the code, checks TypeScript consumer examples against emitted declarations, and runs the tests. `npm run coverage` enforces **100% statements, branches, functions, and lines for each implementation file**. CI also packs the npm artifact, installs it into a clean temporary project, loads the public package entrypoint, and checks committed build output for drift.

Tests exercise the compiled JavaScript interface used by downstream callers. Coverage is an execution metric, not proof that all possible inputs or external integrations are correct.
