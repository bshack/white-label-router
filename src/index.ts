/** Navigation payload, including caller-defined metadata. */
interface NavigationData {url?: string; [key: string]: unknown}
/** URL-derived values supplied to route handlers. */
interface LocationData {url: string; data: {url: string[]; mediator: NavigationData | undefined; query: Record<string, string>}}
type RouteHandler = (scope: Element | null, location: LocationData) => unknown;
interface RouteViewLifecycle {initialize?: RouteHandler; destroy?: RouteHandler}
/** An object route can own a function or a view lifecycle. */
interface RouteObject {title?: string; focus?: string | false; secure?: RouteHandler; view?: RouteHandler | RouteViewLifecycle}
type Route = RouteHandler | RouteObject;
interface ActiveDestroy {receiver: RouteViewLifecycle; callback: RouteHandler}
/** Minimal standards-based event target contract required by the router. */
interface NavigationMediator {
    addEventListener(type: string, callback: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener(type: string, callback: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}
/** Route keys compiled for prefix lookup; rebuilt only when the own key list changes. */
interface CompiledRoutes {keys: string[]; prefixes: Map<string, string>; prefixFor: Map<string, string>}

/** Placeholder default routes created by the constructor rather than configured by the application. */
const builtInDefaultRoutes = new WeakSet<object>();
/** Fixed origin used to put route keys through the same WHATWG path normalization as navigation URLs. */
const routeKeyBase = 'http://white-label.invalid';

/** Encode a path-like route key the way URL parsing encodes pathnames, so '/café' matches '/caf%C3%A9'. */
function normalizeRouteKey(key: string) {
    // Keys that are not absolute paths, or that carry query/hash syntax, can never be a pathname; keep them inert.
    if (!key.startsWith('/') || /[?#]/.test(key)) {return key;}
    return new URL(`${routeKeyBase}${key}`).pathname;
}

/** Path and query without the fragment. */
function withoutHash(url: string) {
    const index = url.indexOf('#');
    return index === -1 ? url : url.slice(0, index);
}

/** History API router that also dispatches request URLs in non-browser runtimes. */
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
    // Incremented by every committed navigation so a superseded (re-entered) navigation stops committing.
    private navigationToken = 0;
    private initialDispatch = false;
    private suppressFocus = false;

    /** Create an instance with its own state and listener references. */
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

    get mediator(): NavigationMediator | false {return this.currentMediator;}

    /** Move an active router:navigate subscription when the mediator changes. */
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

    get navigationRoot(): Document | Element | null {return this.currentNavigationRoot;}

    /** Scope progressive link interception and move an active click listener when the root changes. */
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

    /** True when browser navigation APIs are available. */
    private isBrowserRuntime() {
        return typeof window !== 'undefined' && typeof document !== 'undefined';
    }

    /** Stable base URL for WHATWG URL parsing in browser and server runtimes. */
    private getOrigin() {
        return this.isBrowserRuntime() ? window.location.origin : 'http://white-label.invalid';
    }

    /** Read the authoritative browser URL, or retain the supplied server URL. */
    private getCurrentUrl() {
        if (!this.isBrowserRuntime()) {return this.url || '/';}
        return window.location.pathname + window.location.search + (window.location.hash || '');
    }

    /** Parse a navigation candidate without changing Router state. */
    private parseNavigationUrl(url: string) {
        try {
            const base = this.isBrowserRuntime() ? window.location.href || `${window.location.origin}/` : this.getOrigin();
            return new URL(url || '/', base);
        } catch (_error) {
            return null;
        }
    }

    /** Normalize browser navigation to a same-origin path, query, and hash. */
    private normalizeBrowserUrl(url: string) {
        if (!this.isBrowserRuntime()) {return url;}
        const parsedUrl = this.parseNavigationUrl(url);
        if (!parsedUrl || parsedUrl.origin !== window.location.origin) {return null;}
        return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
    }

    /** Return whether a selected route has runnable view behavior. */
    private isRunnableRoute(route: Route): boolean {
        return typeof route === 'function' || typeof route.view === 'function' ||
            Boolean(route.view && typeof route.view.initialize === 'function');
    }
    /** Compile own route keys into a prefix map, reusing the previous compilation while the key list is unchanged. */
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
            // Equivalent spellings resolve independently of insertion order: the canonical spelling, then the lowest key.
            if (existing === undefined || (existing !== prefix && (key === prefix || key < existing))) {prefixes.set(prefix, key);}
        }
        this.compiledRoutes = {keys, prefixes, prefixFor};
        return this.compiledRoutes;
    }

    /** Return the longest matching own route-table prefix, falling back to defaultRoute when configured. */
    private matchRoute(pathname: string): string | null {
        const {prefixes} = this.compileRoutes();
        // Walk complete path boundaries from longest to shortest, so the first hit is the longest match.
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

    /** Matched pathname prefix length for a route key, as compiled for matching. */
    private routePrefixLength(route: string | null) {
        if (!route || route === 'defaultRoute') {return 0;}
        return (this.compileRoutes().prefixFor.get(route) ?? normalizeRouteKey(route)).length;
    }

    /** Parse Router's own committed path without letting a leading '//' turn into an authority. */
    private parseStoredUrl(url: string) {
        if (!url.startsWith('/')) {return this.parseNavigationUrl(url);}
        try {
            return new URL(`${this.getOrigin()}${url}`);
        } catch (_error) {
            return null;
        }
    }

    /** Build decoded path, query, and mediator data for a navigation candidate. */
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
     * Start this instance and return it for lifecycle chaining.
     * In a browser the URL is optional and defaults to window.location. On a server pass the request URL.
     */
    initialize(url?: string) {
        this.addListeners();
        // The browser already owns focus for the document it just loaded; only later route changes move it.
        this.initialDispatch = true;
        try {
            this.navigate(url ?? this.getCurrentUrl(), {}, true);
        } finally {
            this.initialDispatch = false;
        }
        return this;
    }

    /** Register browser and optional mediator handlers once. */
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

    /** Release owned state and listeners so the instance can leave the application lifecycle. */
    destroy() {
        this.removeListeners();
        return this;
    }

    /** Release listeners owned by this instance; subclasses may extend the lifecycle hook. */
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

    /** Intercept eligible same-origin push-state links while preserving normal browser actions. */
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
        // The attribute, not the property: SVG <a>.href is an SVGAnimatedString rather than a URL string.
        const href = anchor.getAttribute('href') ?? '';
        const baseUrl = typeof document !== 'undefined' && document.baseURI
            ? document.baseURI
            : window.location.href || `${window.location.origin}/`;
        let location: URL;
        try {location = new URL(href, baseUrl);} catch {return true;}
        if (location.origin !== window.location.origin) {return true;}
        const candidateRoute = this.matchRoute(location.pathname);
        const selected = candidateRoute ? this.routes[candidateRoute] : undefined;
        if (!selected || !this.isRunnableRoute(selected) || builtInDefaultRoutes.has(selected)) {return true;}
        // Guards are synchronous, so navigate first and cancel the native action only when Router took the link;
        // a guard-rejected link then still navigates natively.
        const token = this.navigationToken;
        let handled = false;
        try {
            handled = this.navigate(`${location.pathname}${location.search}${location.hash}`, {}, false) !== false;
        } finally {
            if (handled || this.navigationToken !== token) {e.preventDefault();}
        }
        return handled ? this : true;
    }

    /** Restore browser history state without adding a new history entry. */
    eventPopState() {
        if (typeof window === 'undefined') {return this;}
        const currentUrl = this.getCurrentUrl();
        // Same-document fragment navigation (footnotes, skip links) keeps the active route, its view, and focus.
        if (this.route !== null && withoutHash(currentUrl) === withoutHash(this.url)) {
            this.url = currentUrl;
            this.locationData = {...this.locationData, url: currentUrl};
            return this;
        }
        this.navigate(currentUrl, {}, true);
        return this;
    }

    /** Decode URL query parameters, keeping the last value for duplicate keys. */
    parseQueryString(queryString: string) {
        return Object.fromEntries(new URLSearchParams(queryString));
    }

    /** Build decoded path, query, and mediator data for the selected route. */
    setLocationData(mediatorData?: NavigationData) {
        const parsedUrl = this.parseStoredUrl(this.url || '/');
        if (!parsedUrl) {return;}
        this.locationData = this.buildLocationData(this.url, this.route, mediatorData, parsedUrl);
    }

    /** Update page context after a route renders. DOM effects are browser-only. */
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

    /** Select a route, enforce its guard, transition view lifecycles, and update browser history when available. */
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

        // Both runtimes commit the documented path + query (+ hash) form, never a full absolute URL.
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
        // Release ownership before calling out, so a navigation started inside destroy() cannot run it twice.
        const previous = this.activeDestroy;
        this.activeDestroy = undefined;
        if (previous) {
            previous.callback.call(previous.receiver, this.scope, candidateLocationData);
            if (token !== this.navigationToken) {return this;}
        }
        const selectedView = typeof selected !== 'function' && typeof selected.view === 'object'
            ? selected.view
            : undefined;
        // Own the lifecycle before initialize() runs: a nested navigation or a throwing initialize() still tears it down.
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
        // A navigation started during initialize() has already committed its own title, focus, and history.
        if (token !== this.navigationToken) {return this;}
        this.suppressFocus = skipFocus;
        try {
            this.applyPageContext(selected);
        } finally {
            this.suppressFocus = false;
        }
        if (token !== this.navigationToken) {return this;}
        this.previousRoute = this.route;
        if (!isPopState && this.isBrowserRuntime()) {
            window.history.pushState(this.url, this.pageTitle || '', parsedUrl.href);
        }
        return this;
    }
}

/** Public route configuration and navigation payload types. */
namespace Router {
    export type Handler = RouteHandler;
    export type Route = RouteHandler | RouteObject;
    export type Location = LocationData;
    export type Navigation = NavigationData;
}
export = Router;
