# white-label-router

`white-label-router` is a small client-side router built on the browser History API. It maps URL prefixes to functions or view lifecycle objects, intercepts links marked with `data-pushstate`, handles browser back/forward navigation, and can receive navigation requests through a mediator.

## Requirements

- Node.js `^22.18.0` or `>=24.11.0` for installation and development
- A browser environment with `window.history`, `window.location`, and standard DOM events at runtime
- Server fallback configuration that serves the application entry page for client-managed URLs

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

Routes use prefix matching in object insertion order. For example, `/products` matches both `/products` and `/products/42`. Put more specific prefixes before broader ones:

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

Values are not URI-decoded by the router. Decode and validate route or query values in application code before using them.

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
npm test
npm run audit
```

The npm package publishes the compiled `dist` file and this README.
