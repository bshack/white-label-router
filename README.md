# white-label-router

`white-label-router` is a small client-side router built on the browser History API. It maps URL prefixes to functions or view lifecycle objects, intercepts links marked with `data-pushstate`, handles browser back/forward navigation, and can receive navigation requests through a mediator.

## Requirements

- Node.js `^22.18.0` or `>=24.11.0` for installation and development
- A browser environment with `window.history`, `window.location`, and standard DOM events at runtime
- Server fallback configuration that serves the application entry page for client-managed URLs

## Accessibility and indexability

Use real `<a href="...">` links and add `data-pushstate` only as progressive enhancement. This preserves keyboard behavior, context-menu actions, no-JavaScript navigation, and crawler discovery. Every public route needs a directly requestable URL that returns meaningful HTML, a unique title and description, a canonical URL, and the correct robots policy.

Client-side route changes should manage document title and focus deliberately. Avoid moving focus for same-page refinements unless the interaction requires it.

## Versioning policy

Backward compatibility is not maintained through sentinel arguments, optional adapter methods, aliases, or runtime fallbacks. Breaking public API changes are communicated with a Semantic Versioning major release and release notes outside this README.

## Install and import

```sh
npm install white-label-router
```

```js
import Router from 'white-label-router';
```

## Complete example

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

At startup, `initialize()` reads the current path and query string, registers document click and browser `popstate` listeners, and dispatches the matching route without adding a duplicate history entry.

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

The router delegates one document-level click listener. Add `data-pushstate` to an anchor to use client-side navigation:

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

The second argument becomes `location.data.mediator`. Unless the call represents browser `popstate`, successful navigation adds the URL to browser history.

Call `navigate()` without a URL, or pass `undefined`, to dispatch the browser's current URL.

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

Path segments and query values are URI-decoded with browser-native URL APIs. Application code must still validate values before using them.

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

The complete emitted object is passed to the route as `location.data.mediator`. `destroy()` removes document, window, and mediator listeners. Repeated listener initialization is idempotent and does not add duplicates.

## Page title and focus

Object routes can set a title and move focus after rendering:

```ts
router.routes = {
    '/account': {
        title: 'Account',
        focus: '#account-title',
        view: renderAccount
    }
};
```

The default focus selector is `main h1`. Set `focus: false` for an in-page state change that should preserve the user's current focus. A focused element receives `tabindex="-1"` only when it does not already have a tabindex.

## Current navigation behavior

Initialization dispatches the current URL without adding a duplicate history entry. Back/forward navigation reads `window.location`, including path, query, and hash, even when history state is null or belongs to another application. History state is not treated as the authoritative URL.

## Lifecycle

| Method | Behavior |
| --- | --- |
| `initialize()` | Reads the browser URL, adds listeners, and runs the initial route. |
| `navigate(url?, data?, isPopState?)` | Matches and runs a route, updates history when appropriate, and returns the router; returns `false` when blocked or invalid. |
| `addListeners()` | Adds browser and optional mediator listeners once. |
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

`Router.Route` covers function routes and objects with a guard or view lifecycle. `Router.Location` describes decoded URL data, `Router.Navigation` describes mediator payloads, and `Router.Handler` describes a route callback. Browser DOM types are required when compiling a consuming application.

The distribution is CommonJS emitted by TypeScript. CommonJS `require` and the documented ESM imports are supported through normal Node or bundler interoperability. Edit `src/*.ts`, then run `npm run build`; do not edit generated `dist` files.

## Verification and coverage

The package has no runtime dependency on model, mediator, or view. Package tests cover the router contract independently; consuming applications are responsible for their own integration testing.

```sh
npm ci --ignore-scripts
npm run lint
npm run typecheck
npm test
npm run coverage
npm run audit
npm pack --dry-run
```

`npm test` builds the code, checks TypeScript consumer examples against emitted declarations, and runs the tests. `npm run coverage` enforces **100% statements, branches, functions, and lines for each implementation file**. CI runs the same gate and checks committed build output for drift.

Tests exercise the compiled JavaScript interface used by downstream callers. Coverage is an execution metric, not proof that all possible inputs or external integrations are correct.
