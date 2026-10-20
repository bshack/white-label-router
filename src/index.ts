/** Extra data passed with a navigation. `url`, if present, is the destination; any other fields are yours. */
interface NavigationData {url?: string; [key: string]: unknown}
/**
 * What a route callback receives about the destination.
 * `url` is the path, query, and hash; `data.url` holds the decoded path segments after the matched route key;
 * `data.query` holds decoded query values; `data.mediator` is the navigation data, if any.
 */
interface LocationData {url: string; data: {url: string[]; mediator: NavigationData | undefined; query: Record<string, string>}}
/** A route callback. It receives `router.scope` and the destination location. */
type RouteHandler = (scope: Element | null, location: LocationData) => unknown;
/** A view with setup and teardown. `destroy` receives the location being navigated to. */
interface RouteViewLifecycle {initialize?: RouteHandler; destroy?: RouteHandler}
/**
 * A route with optional page context and a guard.
 * `secure` must return exactly `true` to allow navigation; `focus: false` leaves focus where it is.
 */
interface RouteObject {title?: string; focus?: string | false; secure?: RouteHandler; view?: RouteHandler | RouteViewLifecycle}
type Route = RouteHandler | RouteObject;
/** The teardown captured from the view that actually initialized, so later route-table edits can't change it. */
interface ActiveDestroy {receiver: RouteViewLifecycle; callback: RouteHandler}
/** Any EventTarget-like object; Router only adds and removes a `router:navigate` listener on it. */
interface NavigationMediator {
    addEventListener(type: string, callback: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener(type: string, callback: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}
/**
 * Route keys prepared for fast matching. `prefixes` maps a normalized path to the route key that owns it;
 * `prefixFor` maps each key to its normalized path. Rebuilt only when the list of own keys changes.
 */
interface CompiledRoutes {keys: string[]; prefixes: Map<string, string>; prefixFor: Map<string, string>}

/** The do-nothing `defaultRoute` objects each constructor installs, so link clicks can tell them apart from app routes. */
const builtInDefaultRoutes = new WeakSet<object>();
/** A dummy origin that lets route keys and server URLs go through the standard URL parser. */
const routeKeyBase = 'http://white-label.invalid';

/** Encode a route key the way the URL parser encodes paths, so `'/café'` matches `/caf%C3%A9`. */
function normalizeRouteKey(key: string) {
    // A key that doesn't start with '/' or contains '?' or '#' can never equal a pathname, so leave it as is (it won't match).
    if (!key.startsWith('/') || /[?#]/.test(key)) {return key;}
    return new URL(`${routeKeyBase}${key}`).pathname;
}

/** Strip the `#fragment`, leaving the path and query. */
function withoutHash(url: string) {
    const index = url.indexOf('#');
    return index === -1 ? url : url.slice(0, index);
}

/**
 * Maps URLs to route callbacks. In a browser it enhances `data-pushstate` links and back/forward with the History API;
 * on a server it dispatches the request URL you pass, with no DOM required.
 */
class Router {
    routes: Record<string, Route>;
    url: string;
    route: string | null;
    scope: Element | null;
    previousRoute: string | null;
    pageTitle: string | null;
    boundPushStateClick: (event: MouseEvent) => unknown;
    boundPopState: (event: PopStateEvent) => unknown;
    boundMediatorNavigate: EventListener;
    listenersInitialized: boolean;
    locationData: LocationData = {url: '', data: {url: [], mediator: undefined, query: {}}};
    private currentMediator: NavigationMediator | false = false;
    private boundMediator: NavigationMediator | false = false;
    private currentNavigationRoot: Document | Element | null = null;
    private boundNavigationRoot: Document | Element | null = null;
    private activeDestroy: ActiveDestroy | undefined;
    private compiledRoutes: CompiledRoutes | undefined;
    // Bumped by each navigation that passes its guard. If it changes while a navigation is calling out to app code,
    // a newer navigation has started, and the older one stops before touching title, focus, or history.
    private navigationToken = 0;
    // True only for the first navigate() call made by initialize(), so that dispatch leaves focus alone.
    private initialDispatch = false;
    // Tells applyPageContext() to skip focus for the current call.
    private suppressFocus = false;

    /** Create a router with a placeholder `defaultRoute` and no listeners attached yet. */
    constructor() {
        const defaultRoute: RouteObject = {
            view: {
                initialize: () => true,
                destroy: () => true
            }
        };
        builtInDefaultRoutes.add(defaultRoute);
        this.routes = {defaultRoute};
        this.url = '';
        this.route = null;
        this.scope = null;
        this.previousRoute = null;
        this.pageTitle = null;
        this.boundPushStateClick = this.eventPushStateClick.bind(this);
        this.boundPopState = this.eventPopState.bind(this);
        this.boundMediatorNavigate = (event: Event) => {
            const detail = (event as CustomEvent<unknown>).detail;
            if (detail === undefined || detail === null) {
                this.navigate(undefined, {}, false);
                return;
            }
            if (typeof detail !== 'object' || Array.isArray(detail)) {return;}
            const data = detail as NavigationData;
            this.navigate(data.url, data, false);
        };
        this.listenersInitialized = false;
    }

    /** Event target that can send `router:navigate` events, or `false` for none. */
    get mediator(): NavigationMediator | false {return this.currentMediator;}

    /** Set the mediator. If listeners are active, the `router:navigate` listener moves from the old one to the new one. */
    set mediator(value: NavigationMediator | false) {
        if (value === this.currentMediator) {return;}
        if (this.listenersInitialized && this.boundMediator) {
            this.boundMediator.removeEventListener('router:navigate', this.boundMediatorNavigate);
            this.boundMediator = false;
        }
        this.currentMediator = value;
        if (this.listenersInitialized && value) {
            value.addEventListener('router:navigate', this.boundMediatorNavigate);
            this.boundMediator = value;
        }
    }

    /** Element or document whose `data-pushstate` link clicks this router handles; `null` means the whole document. */
    get navigationRoot(): Document | Element | null {return this.currentNavigationRoot;}

    /** Set the click root. If listeners are active, the click listener moves to the new root. */
    set navigationRoot(value: Document | Element | null) {
        if (value === this.currentNavigationRoot) {return;}
        if (this.listenersInitialized && this.isBrowserRuntime()) {
            this.boundNavigationRoot?.removeEventListener('click', this.boundPushStateClick as EventListener);
            this.currentNavigationRoot = value;
            const nextRoot = value || document;
            nextRoot.addEventListener('click', this.boundPushStateClick as EventListener);
            this.boundNavigationRoot = nextRoot;
            return;
        }
        this.currentNavigationRoot = value;
    }

    /** True when `window` and `document` exist, i.e. browser-only effects should run. */
    private isBrowserRuntime() {
        return typeof window !== 'undefined' && typeof document !== 'undefined';
    }

    /** Origin used as the base for URL parsing: the page's origin in a browser, a dummy one on a server. */
    private getOrigin() {
        return this.isBrowserRuntime() ? window.location.origin : 'http://white-label.invalid';
    }

    /** Current path, query, and hash: from `window.location` in a browser, or the last committed URL (default `/`) on a server. */
    private getCurrentUrl() {
        if (!this.isBrowserRuntime()) {return this.url || '/';}
        return window.location.pathname + window.location.search + (window.location.hash || '');
    }

    /** Parse a URL relative to the current page (or the dummy server origin). Returns `null` if it can't be parsed. */
    private parseNavigationUrl(url: string) {
        try {
            const base = this.isBrowserRuntime() ? window.location.href || `${window.location.origin}/` : this.getOrigin();
            return new URL(url || '/', base);
        } catch (_error) {
            return null;
        }
    }

    /** In a browser, reduce a URL to its path, query, and hash, or `null` if it is cross-origin or invalid. */
    private normalizeBrowserUrl(url: string) {
        if (!this.isBrowserRuntime()) {return url;}
        const parsedUrl = this.parseNavigationUrl(url);
        if (!parsedUrl || parsedUrl.origin !== window.location.origin) {return null;}
        return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
    }

    /** True if the route has something to run: a function, a `view` function, or a `view.initialize`. */
    private isRunnableRoute(route: Route): boolean {
        return typeof route === 'function' || typeof route.view === 'function' ||
            Boolean(route.view && typeof route.view.initialize === 'function');
    }
    /** Build (or reuse) the lookup tables for the current route keys. Reused while the own key list is unchanged. */
    private compileRoutes(): CompiledRoutes {
        const keys = Object.keys(this.routes);
        const cached = this.compiledRoutes;
        if (cached && cached.keys.length === keys.length && cached.keys.every((key, index) => key === keys[index])) {
            return cached;
        }
        const prefixes = new Map<string, string>();
        const prefixFor = new Map<string, string>();
        for (const key of keys) {
            if (key === 'defaultRoute') {continue;}
            const prefix = normalizeRouteKey(key);
            prefixFor.set(key, prefix);
            const existing = prefixes.get(prefix);
            // When two keys normalize to the same path, prefer the one already in normalized form, then the alphabetically
            // lowest, so the winner never depends on insertion order.
            if (existing === undefined || (existing !== prefix && (key === prefix || key < existing))) {prefixes.set(prefix, key);}
        }
        this.compiledRoutes = {keys, prefixes, prefixFor};
        return this.compiledRoutes;
    }

    /** Find the route key with the longest matching path prefix, else `'defaultRoute'` if one is set, else `null`. */
    private matchRoute(pathname: string): string | null {
        const {prefixes} = this.compileRoutes();
        // Try the full path, then drop one '/segment' at a time; the first hit is the longest match.
        // Cutting only at '/' means '/products' matches '/products/42' but not '/products-old'.
        let candidateRoute = prefixes.get(pathname);
        let index = pathname.lastIndexOf('/');
        while (candidateRoute === undefined && index >= 0) {
            candidateRoute = prefixes.get(pathname.slice(0, index));
            index = index > 0 ? pathname.lastIndexOf('/', index - 1) : -1;
        }
        if (candidateRoute !== undefined) {return candidateRoute;}
        if (Object.prototype.hasOwnProperty.call(this.routes, 'defaultRoute') && this.routes.defaultRoute) {
            return 'defaultRoute';
        }
        return null;
    }

    /** Length of the normalized path for a route key, used to slice the matched prefix off `data.url`; 0 for `defaultRoute`. */
    private routePrefixLength(route: string | null) {
        if (!route || route === 'defaultRoute') {return 0;}
        return (this.compileRoutes().prefixFor.get(route) ?? normalizeRouteKey(route)).length;
    }

    /** Parse a URL Router committed earlier. A path is prefixed with the origin first, so '//x' stays a path, not a host. */
    private parseStoredUrl(url: string) {
        if (!url.startsWith('/')) {return this.parseNavigationUrl(url);}
        try {
            return new URL(`${this.getOrigin()}${url}`);
        } catch (_error) {
            return null;
        }
    }

    /** Build the location object passed to route callbacks. Path segments that fail to decode are kept as-is. */
    private buildLocationData(url: string, route: string | null, mediatorData: NavigationData | undefined, parsedUrl: URL): LocationData {
        return {
            url,
            data: {
                url: parsedUrl.pathname
                    .slice(this.routePrefixLength(route))
                    .split('/')
                    .filter(Boolean)
                    .map((fragment) => {
                        try {return decodeURIComponent(fragment);} catch (_error) {return fragment;}
                    }),
                mediator: mediatorData,
                query: this.parseQueryString(parsedUrl.search)
            }
        };
    }

    /**
     * Attach listeners and dispatch the starting URL. Does not add a history entry or move focus.
     * @param url - Request URL on a server. In a browser, omit it to use `window.location`.
     * @returns This router.
     * @throws Whatever a guard or route callback throws.
     */
    initialize(url?: string) {
        this.addListeners();
        // The browser has already placed focus on the page it just loaded, so only later navigations move it.
        this.initialDispatch = true;
        try {
            this.navigate(url ?? this.getCurrentUrl(), {}, true);
        } finally {
            this.initialDispatch = false;
        }
        return this;
    }

    /**
     * Attach the click and popstate listeners (browser only) and the mediator listener. Safe to call more than once.
     * @returns This router.
     */
    addListeners() {
        if (this.listenersInitialized) {return this;}
        if (this.isBrowserRuntime()) {
            const navigationRoot = this.currentNavigationRoot || document;
            navigationRoot.addEventListener('click', this.boundPushStateClick as EventListener);
            this.boundNavigationRoot = navigationRoot;
            window.addEventListener('popstate', this.boundPopState);
        }
        if (this.currentMediator) {
            this.currentMediator.addEventListener('router:navigate', this.boundMediatorNavigate);
            this.boundMediator = this.currentMediator;
        }
        this.listenersInitialized = true;
        return this;
    }

    /**
     * Remove this router's listeners. Does not call the active route's `destroy()`.
     * @returns This router.
     */
    destroy() {
        this.removeListeners();
        return this;
    }

    /**
     * Remove the listeners `addListeners()` attached. Subclasses can override this to release more.
     * @returns This router.
     */
    removeListeners() {
        if (!this.listenersInitialized) {return this;}
        if (this.isBrowserRuntime()) {
            this.boundNavigationRoot?.removeEventListener('click', this.boundPushStateClick as EventListener);
            this.boundNavigationRoot = null;
            window.removeEventListener('popstate', this.boundPopState);
        }
        if (this.boundMediator) {
            this.boundMediator.removeEventListener('router:navigate', this.boundMediatorNavigate);
            this.boundMediator = false;
        }
        this.listenersInitialized = false;
        return this;
    }

    /**
     * Click handler for `<a href data-pushstate>` links. Takes over only when Router can handle the link:
     * a plain left click on a same-origin link (no `download`, no other `target`) whose route is app-defined,
     * runnable, and allowed by its guard, and that is not just a `#fragment` of the current page. Anything else is left
     * to the browser.
     * @param e - The click event.
     * @returns This router if it handled the click, otherwise `true`.
     * @throws Whatever a guard or route callback throws.
     */
    eventPushStateClick(e: MouseEvent) {
        if (typeof window === 'undefined') {return true;}
        if (e.defaultPrevented || (e.button !== undefined && e.button !== 0) || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
            return true;
        }
        const eventTarget = e.target as Element | null;
        const source = eventTarget && (typeof eventTarget.closest === 'function' ? eventTarget : eventTarget.parentElement);
        const anchor = source && typeof source.closest === 'function' ? source.closest('a[href][data-pushstate]') : null;
        if (!anchor) {return true;}
        const target = anchor.getAttribute('target');
        if (anchor.hasAttribute('download') || (target && target.toLowerCase() !== '_self')) {return true;}
        // Read the attribute, because on an SVG <a> the href property is an SVGAnimatedString, not a URL.
        const href = anchor.getAttribute('href') ?? '';
        const baseUrl = typeof document !== 'undefined' && document.baseURI
            ? document.baseURI
            : window.location.href || `${window.location.origin}/`;
        let location: URL;
        try {location = new URL(href, baseUrl);} catch {return true;}
        if (location.origin !== window.location.origin) {return true;}
        // A link to a #fragment of the page already shown is native fragment navigation: let the browser scroll to it.
        // Its popstate then only updates `url`, matching the fragment-only back/forward rule.
        if (location.href.includes('#') && location.pathname === window.location.pathname && location.search === window.location.search) {
            return true;
        }
        const candidateRoute = this.matchRoute(location.pathname);
        const selected = candidateRoute ? this.routes[candidateRoute] : undefined;
        if (!selected || !this.isRunnableRoute(selected) || builtInDefaultRoutes.has(selected)) {return true;}
        // Guards are synchronous, so try the navigation first and cancel the browser's default only if Router took it.
        // A rejected (or throwing) guard therefore falls back to a normal page load. If the route committed and then
        // threw, the token has moved, so the default is still cancelled and the browser doesn't navigate twice.
        const token = this.navigationToken;
        let handled = false;
        try {
            handled = this.navigate(`${location.pathname}${location.search}${location.hash}`, {}, false) !== false;
        } finally {
            if (handled || this.navigationToken !== token) {e.preventDefault();}
        }
        return handled ? this : true;
    }

    /**
     * Popstate handler for back/forward. Runs the route for the new URL without adding a history entry.
     * A hash-only change just updates `url` and `locationData.url`.
     * @returns This router.
     */
    eventPopState() {
        if (typeof window === 'undefined') {return this;}
        const currentUrl = this.getCurrentUrl();
        // Moving between #fragments on the same page (footnotes, skip links) keeps the current view and focus.
        if (this.route !== null && withoutHash(currentUrl) === withoutHash(this.url)) {
            this.url = currentUrl;
            this.locationData = {...this.locationData, url: currentUrl};
            return this;
        }
        this.navigate(currentUrl, {}, true);
        return this;
    }

    /**
     * Decode a query string into a plain object. For repeated keys the last value wins.
     * @param queryString - Query string, with or without the leading `?`.
     */
    parseQueryString(queryString: string) {
        return Object.fromEntries(new URLSearchParams(queryString));
    }

    /**
     * Rebuild `locationData` from the current `url` and `route`. Leaves it unchanged if the URL can't be parsed.
     * @param mediatorData - Value to expose as `locationData.data.mediator`.
     */
    setLocationData(mediatorData?: NavigationData) {
        const parsedUrl = this.parseStoredUrl(this.url || '/');
        if (!parsedUrl) {return;}
        this.locationData = this.buildLocationData(this.url, this.route, mediatorData, parsedUrl);
    }

    /**
     * Record the route's title in `pageTitle` and, in a browser, set `document.title` and move focus to the route's
     * `focus` selector (default `main h1`), adding `tabindex="-1"` if needed. `focus: false` skips focus.
     * @param route - The route that just ran.
     * @returns This router.
     */
    applyPageContext(route: Route) {
        if (typeof route === 'function') {
            this.pageTitle = null;
            return this;
        }
        this.pageTitle = typeof route.title === 'string' ? route.title : null;
        if (!this.isBrowserRuntime()) {return this;}
        if (this.pageTitle) {document.title = this.pageTitle;}
        if (route.focus !== false && !this.suppressFocus) {
            const target = document.querySelector<HTMLElement>(route.focus || 'main h1');
            if (target) {
                if (!target.hasAttribute('tabindex')) {target.setAttribute('tabindex', '-1');}
                target.focus();
            }
        }
        return this;
    }

    /**
     * Navigate to a URL: match the route, run its guard, commit the new state, call the previous route's `destroy()`,
     * run the new route, apply title and focus, then push a history entry (browser only, unless `isPopState`).
     * If route code starts another navigation part-way through, that one wins and this call stops early.
     * @param url - Destination URL. Omit to re-run the last committed URL (or the current browser URL / `/` at first).
     * @param mediatorData - Value exposed to the route as `location.data.mediator`.
     * @param isPopState - `true` to skip adding a history entry.
     * @returns This router, or `false` if the navigation was rejected (bad or cross-origin URL, no matching route,
     * guard refused, or nothing to run). A rejected navigation changes nothing.
     * @throws Whatever a guard or route callback throws. A throwing guard changes nothing; a throwing route stays committed.
     */
    navigate(url?: string, mediatorData?: NavigationData, isPopState = false) {
        const skipFocus = this.initialDispatch;
        this.initialDispatch = false;
        if (url !== undefined && typeof url !== 'string') {return false;}

        const candidateInput = url !== undefined ? url : this.url;
        let parsedUrl: URL | null;
        if (!candidateInput) {
            parsedUrl = this.parseNavigationUrl(this.getCurrentUrl());
        } else {
            parsedUrl = url === undefined ? this.parseStoredUrl(candidateInput) : this.parseNavigationUrl(candidateInput);
        }
        if (!parsedUrl) {return false;}
        if (this.isBrowserRuntime() && parsedUrl.origin !== window.location.origin) {return false;}

        // Store only path, query, and hash, even when a server passed an absolute URL.
        const candidateUrl = `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
        const candidateRoute = this.matchRoute(parsedUrl.pathname);
        if (!candidateRoute) {return false;}

        const candidateLocationData = this.buildLocationData(candidateUrl, candidateRoute, mediatorData, parsedUrl);
        const selected = this.routes[candidateRoute];
        if (!selected || (typeof selected !== 'function' && selected.secure && selected.secure(this.scope, candidateLocationData) !== true) ||
            !this.isRunnableRoute(selected)) {
            return false;
        }

        const token = ++this.navigationToken;
        this.url = candidateUrl;
        this.route = candidateRoute;
        this.locationData = candidateLocationData;
        // Clear the stored teardown before calling it, so a navigation started inside destroy() can't call it again,
        // and a destroy() that throws is not retried: its error propagates with the destination committed but not run.
        const previous = this.activeDestroy;
        this.activeDestroy = undefined;
        if (previous) {
            previous.callback.call(previous.receiver, this.scope, candidateLocationData);
            if (token !== this.navigationToken) {return this;}
        }
        const selectedView = typeof selected !== 'function' && typeof selected.view === 'object'
            ? selected.view
            : undefined;
        // Store the teardown before initialize() runs, so it still runs later if initialize() throws or navigates away.
        this.activeDestroy = selectedView?.destroy
            ? {receiver: selectedView, callback: selectedView.destroy}
            : undefined;
        if (typeof selected === 'function') {
            selected(this.scope, candidateLocationData);
        } else if (typeof selected.view === 'function') {
            selected.view(this.scope, candidateLocationData);
        } else {
            selectedView!.initialize!(this.scope, candidateLocationData);
        }
        // If initialize() started another navigation, that one has already applied its own title, focus, and history.
        if (token !== this.navigationToken) {return this;}
        this.suppressFocus = skipFocus;
        try {
            this.applyPageContext(selected);
        } finally {
            this.suppressFocus = false;
        }
        if (token !== this.navigationToken) {return this;}
        this.previousRoute = this.route;
        // Re-running the current URL (no `url` given, e.g. a mediator event without a destination) must not add a
        // duplicate history entry for the address already shown.
        if (!isPopState && this.isBrowserRuntime() && !(url === undefined && parsedUrl.href === window.location.href)) {
            window.history.pushState(this.url, this.pageTitle || '', parsedUrl.href);
        }
        return this;
    }
}

/** Types for route definitions, location data, and navigation data. */
namespace Router {
    export type Handler = RouteHandler;
    export type Route = RouteHandler | RouteObject;
    export type Location = LocationData;
    export type Navigation = NavigationData;
}
export = Router;
