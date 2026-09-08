# white-label-router

`white-label-router` is a small client-side router built on the browser History API. It maps URL prefixes to functions or view lifecycle objects, intercepts links marked with `data-pushstate`, handles browser back/forward navigation, and can receive navigation requests through a mediator.

## Requirements

- Node.js `^22.18.0` or `>=24.11.0` for installation and development
- A browser environment with `window.history`, `window.location`, and standard DOM events at runtime
- Server fallback configuration that serves the application entry page for client-managed URLs

## Accessibility and indexability

Use real `<a href="...">` links and add `data-pushstate` only as progressive enhancement. This preserves keyboard behavior, context-menu actions, no-JavaScript navigation, and crawler discovery. Every public route needs a directly requestable URL that returns its meaningful HTML, unique title, description, canonical URL, and correct robots policy. Client-only route changes must manage document title and focus deliberately; do not move focus on same-page refinements unless user context requires it.

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

At startup, `initialize()` reads the current path and query string, registers document click and browser `popstate` listeners, and navigates to the matching route.

## Define routes

A route may be a function:

```js
this.routes = {
    '/help': (scope, location) => {
        scope.textContent = `Help page: ${location.url}`;
    }
};
```

Or it may describe a title, security check, and view lifecycle:

```js
this.routes = {
    '/orders': {
        title: 'Orders',
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

### Route matching behavior

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

Clicks on nested elements such as the `span` are resolved to the enclosing anchor. Links without `data-pushstate` keep their normal browser behavior.

Modified clicks, non-left clicks, downloads, links targeting another browsing context, and cross-origin URLs also keep their normal browser behavior.

## Navigate from JavaScript

```js
router.navigate('/products/42', {
    source: 'featured-products'
});
```

The second argument becomes `location.data.mediator`. Unless the call represents a browser `popstate`, successful navigation adds the URL to browser history.

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

## Version 3 migration note

Version 3 changes route matching from unrestricted string prefixes to path boundaries. A route such as `/page2` no longer matches `/page23`. Define `/page23` explicitly if the application previously depended on that behavior.

## Mediator navigation

Assign an EventEmitter-compatible mediator before initialization:

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

The complete emitted object is passed to the route as `location.data.mediator`. `destroy()` removes the document, window, and mediator listeners. Repeated listener initialization is idempotent and does not add duplicate listeners.

## Lifecycle

| Method | Behavior |
| --- | --- |
| `initialize()` | Reads the browser URL, adds listeners, and runs the initial route. |
| `navigate(url, data, isPopState)` | Matches and runs a route, updates history, and returns the router; returns `false` when blocked or invalid. |
| `addListeners()` | Adds browser and optional mediator listeners once. |
| `removeListeners()` | Removes listeners previously added by this router. |
| `destroy()` | Calls `removeListeners()` and returns the router. |

Call `destroy()` when the router is no longer used:

```js
router.destroy();
```

## Development

```sh
npm ci
npm run build
npm run typecheck
npm test
npm run coverage
npm run audit
```

The npm package publishes the compiled `dist` file and this README.

## TypeScript development and version 4.0.0 migration

Implementation code now uses strict TypeScript. Builds emit JavaScript, source maps with embedded source, and `.d.ts` declarations into `dist`. JavaScript callers can still use the package without compiling TypeScript themselves. JSDoc comments describe parameters, return values, lifecycle behavior, and validation at the implementation, and are retained in declarations.

```ts
import Router from 'white-label-router';

const router = new Router();
const greeting: Router.Route = (scope, location) => {
    console.log(location.data.query.name); // /hello?name=Ada
};
router.routes['/hello'] = greeting;
router.initialize();
```

`Router.Route` covers function routes and objects with a guard or view lifecycle. `Router.Location` describes decoded URL data, `Router.Navigation` describes mediator payloads, and `Router.Handler` describes a route callback. Browser DOM types are required when compiling a consuming application.

This is a major release because the distribution is now CommonJS emitted by TypeScript, replacing the previous UMD wrapper. CommonJS `require` and the documented ESM imports remain supported. Direct AMD loading or browser script tags that depended on UMD globals must migrate to a browser bundler. Edit `src/*.ts`, then run `npm run build`; do not edit generated `dist` files. The obsolete Babel build dependencies have been removed.

### Verification and coverage

## Tested compatibility

Version 4.1 is tested with model 3.x, mediator 3.x, and view 4.x. The router has no runtime dependency on those packages.

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run coverage
npm pack --dry-run
```

`npm test` builds the code, checks TypeScript consumer examples against the emitted declarations, and runs the tests. `npm run coverage` additionally enforces **100% statements, branches, functions, and lines for each implementation file**. Unexecuted implementation files count toward the result; declaration-only files contain no executable code and are excluded. Reports are written to `coverage`, including `lcov.info` for coverage viewers. CI runs the same gate and checks committed build output for drift.

Tests exercise the compiled JavaScript interface used by downstream callers. Coverage is an execution metric, not proof that all possible inputs or external integrations are correct.

To undo this migration, revert its commit and run `npm ci` from the restored lockfile. No npm release, database migration, or production deployment is performed by these development changes.
### Page title and focus

Object routes can set a title and move focus after rendering:

```ts
router.routes = {
  '/account': {title: 'Account', focus: '#account-title', view: renderAccount}
};
```

The default focus selector is `main h1`. Set `focus: false` for an in-page state change that should preserve the user's current focus. A focused element receives `tabindex="-1"` only when it does not already have a tabindex.
