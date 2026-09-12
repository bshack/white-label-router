# Browser and server runtimes

`white-label-router` uses the same `Router` class, route definitions, guards, lifecycle callbacks, location data, and `navigate()` method in browser and Node.js runtimes.

Browser applications can continue to initialize from `window.location`:

```js
const router = new Router();
router.initialize();
```

Server applications pass the request URL explicitly:

```js
const router = new Router();
router.routes = routes;
router.initialize(req.originalUrl);
```

The router does not depend on Express. An Express request URL, Node HTTP request URL, or equivalent framework URL can be supplied. Browser-only effects—History API updates, delegated link interception, document title, and focus—are skipped when `window` and `document` are unavailable.

## Request isolation

A router holds mutable navigation state (`url`, `route`, `previousRoute`, `locationData`, and page context). Create a router per concurrent server request, or otherwise provide application-level isolation. Do not share one mutable router instance across unrelated simultaneous requests.

## Security

Route `secure` callbacks are navigation guards. On the server they may participate in request dispatch, but they are not a replacement for the host application's authentication and authorization controls. Enforce access at the server trust boundary before returning protected data.

## URL behavior

Relative request URLs are the recommended server input. Query parsing, duplicate-query handling, path-boundary matching, malformed percent-encoded path fragments, route ordering, default routes, and lifecycle ordering follow the same contract as browser navigation.
