# Browser and server runtimes

`white-label-router` uses the same `Router` class, route definitions, guards, lifecycle callbacks, location data, and `navigate()` method in browser and Node.js runtimes.

Browser applications can continue to initialize from `window.location`:

```js
const router = new Router();
router.initialize();
```

Server applications should pass the host's original request URL representation explicitly. A Web `Request` already provides an absolute URL:

```js
const router = new Router();
router.routes = routes;
router.initialize(request.url);
```

Framework and Node HTTP adapters may instead expose an authoritative relative request URL, for example:

```js
router.initialize(req.originalUrl);
```

The router does not depend on Express. An absolute Web `Request.url`, an Express request URL, a Node HTTP request URL, or an equivalent host URL can be supplied. Preserve the original URL representation instead of parsing an absolute URL and rebuilding it from `pathname + search`; a leading `//` pathname can otherwise be reinterpreted as an authority when parsed again. Browser-only effects—History API updates, delegated link interception, document title, and focus—are skipped when `window` and `document` are unavailable.

## Request isolation

A router holds mutable navigation state (`url`, `route`, `previousRoute`, `locationData`, and page context). Create a router per concurrent server request, or otherwise provide application-level isolation. Do not share one mutable router instance across unrelated simultaneous requests.

## Security

Route `secure` callbacks are navigation guards. On the server they may participate in request dispatch, but they are not a replacement for the host application's authentication and authorization controls. Enforce access at the server trust boundary before returning protected data.

## URL behavior

Absolute and relative request URLs use the same WHATWG URL parsing contract as browser navigation. Query parsing, duplicate-query handling, path-boundary matching, malformed percent-encoded path fragments, route ordering, default routes, and lifecycle ordering follow the same contract across runtimes. A malformed URL candidate is rejected with `false` before Router state changes rather than being committed or thrown through normal navigation flow.
