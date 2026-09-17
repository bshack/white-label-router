# Browser and server runtimes

`white-label-router` uses the same `Router` class, route definitions, guards, lifecycle callbacks, location data, and `navigate()` method in browser and Node.js runtimes.

Browser applications can continue to initialize from `window.location`:

```js
const router = new Router();
router.initialize();
```

Server applications should pass a fully qualified request URL whenever the host provides one. A Web `Request` already does:

```js
const router = new Router();
router.routes = routes;
router.initialize(request.url);
```

Some Node HTTP frameworks expose only a raw origin-form request target such as `/products/42?color=blue`. Prefix that raw value with the application's configured origin **without reparsing it first** so leading slashes keep their path meaning:

```js
const applicationOrigin = 'https://example.com';
router.initialize(`${applicationOrigin}${req.originalUrl}`);
```

This assumes the host's request target starts with `/`, as normal origin-form HTTP request targets do. If an adapter can also receive absolute-form request targets, detect and preserve those separately rather than blindly prefixing them.

The router does not depend on Express. Web `Request.url`, Express/Node request targets, or equivalent host URLs can all be adapted at the edge. Do not parse an absolute URL and rebuild it from `pathname + search`, and do not feed an authority-like raw `//...` request target through `new URL(raw, origin)` before preserving its path; either pattern can change URL meaning. Browser-only effects—History API updates, delegated link interception, document title, and focus—are skipped when `window` and `document` are unavailable.

## Request isolation

A router holds mutable navigation state (`url`, `route`, `previousRoute`, `locationData`, and page context). Create a router per concurrent server request, or otherwise provide application-level isolation. Do not share one mutable router instance across unrelated simultaneous requests.

## Security

Route `secure` callbacks are navigation guards. On the server they may participate in request dispatch, but they are not a replacement for the host application's authentication and authorization controls. Enforce access at the server trust boundary before returning protected data.

## URL behavior

Absolute and ordinary path-relative navigation inputs use the same WHATWG URL parsing contract as browser navigation. Query parsing, duplicate-query handling, path-boundary matching, malformed percent-encoded path fragments, route ordering, default routes, and lifecycle ordering follow the same contract across runtimes. A malformed URL candidate is rejected with `false` before Router state changes rather than being committed or thrown through normal navigation flow.

For raw server request targets, preserve the host's path semantics at the adapter boundary and hand Router an absolute URL. In particular, a raw target beginning `//` is a path in HTTP origin-form but a network-path reference to WHATWG `URL`, so passing it directly as a relative navigation string changes its meaning.
