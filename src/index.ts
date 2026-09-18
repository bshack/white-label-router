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

    /** Create an instance with its own state and listener references. */
    constructor() {
        this.routes = {
            defaultRoute: {
                view: {
                    initialize: () => true,
                    destroy: () => true
                }
            }
        };
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
    /** Return the longest matching own route-table prefix, falling back to defaultRoute when configured. */
    private matchRoute(pathname: string): string | null {
        let candidateRoute: string | null = null;
        for (const route of Object.keys(this.routes)) {
            if (route === 'defaultRoute' || (pathname !== route && !pathname.startsWith(`${route}/`))) {continue;}
            if (!candidateRoute || route.length > candidateRoute.length) {candidateRoute = route;}
        }
        if (!candidateRoute && Object.prototype.hasOwnProperty.call(this.routes, 'defaultRoute') && this.routes.defaultRoute) {
            return 'defaultRoute';
        }
        return candidateRoute;
    }


    /** Build decoded path, query, and mediator data for a navigation candidate. */
    private buildLocationData(url: string, route: string | null, mediatorData: NavigationData | undefined, parsedUrl: URL): LocationData {
        const matchedRoute = route && route !== 'defaultRoute' ? route : '';
        return {
            url,
            data: {
                url: parsedUrl.pathname
                    .slice(matchedRoute.length)
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
        this.navigate(url ?? this.getCurrentUrl(), {}, true);
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
        const href = (anchor as HTMLAnchorElement).href || anchor.getAttribute('href') || '';
        const baseUrl = typeof document !== 'undefined' && document.baseURI
            ? document.baseURI
            : window.location.href || `${window.location.origin}/`;
        let location: URL;
        try {location = new URL(href, baseUrl);} catch {return true;}
        if (location.origin !== window.location.origin) {return true;}
        const candidateRoute = this.matchRoute(location.pathname);
        const selected = candidateRoute ? this.routes[candidateRoute] : undefined;
        if (!selected || !this.isRunnableRoute(selected)) {return true;}
        e.preventDefault();
        this.navigate(`${location.pathname}${location.search}${location.hash}`, {}, false);
        return this;
    }

    /** Restore browser history state without adding a new history entry. */
    eventPopState() {
        if (typeof window === 'undefined') {return this;}
        this.navigate(this.getCurrentUrl(), {}, true);
        return this;
    }

    /** Decode URL query parameters, keeping the last value for duplicate keys. */
    parseQueryString(queryString: string) {
        return Object.fromEntries(new URLSearchParams(queryString));
    }

    /** Build decoded path, query, and mediator data for the selected route. */
    setLocationData(mediatorData?: NavigationData) {
        const url = this.url || '/';
        let parsedUrl: URL;
        try {
            const value = this.isBrowserRuntime() ? `${window.location.origin}${url}` : url;
            parsedUrl = new URL(value, this.getOrigin());
        } catch (_error) {
            return;
        }
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
        if (route.focus !== false) {
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
        if (url !== undefined && typeof url !== 'string') {return false;}

        let candidateInput = url !== undefined ? url : this.url;
        if (!candidateInput) {candidateInput = this.getCurrentUrl();}
        const parsedUrl = this.parseNavigationUrl(candidateInput);
        if (!parsedUrl) {return false;}
        if (this.isBrowserRuntime() && parsedUrl.origin !== window.location.origin) {return false;}

        const candidateUrl = this.isBrowserRuntime()
            ? `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`
            : candidateInput;
        const candidateRoute = this.matchRoute(parsedUrl.pathname);
        if (!candidateRoute) {return false;}

        const candidateLocationData = this.buildLocationData(candidateUrl, candidateRoute, mediatorData, parsedUrl);
        const selected = this.routes[candidateRoute];
        if (!selected || (typeof selected !== 'function' && selected.secure && selected.secure(this.scope, candidateLocationData) !== true) ||
            !this.isRunnableRoute(selected)) {
            return false;
        }

        this.url = candidateUrl;
        this.route = candidateRoute;
        this.locationData = candidateLocationData;
        if (selected) {
            if (this.activeDestroy) {
                const {receiver, callback} = this.activeDestroy;
                callback.call(receiver, this.scope, this.locationData);
                this.activeDestroy = undefined;
            }
            if (typeof selected === 'function') {
                selected(this.scope, this.locationData);
            } else if (typeof selected.view === 'function') {
                selected.view(this.scope, this.locationData);
            } else {
                selected.view!.initialize!(this.scope, this.locationData);
            }
            this.applyPageContext(selected);
            this.previousRoute = this.route;
            const selectedView = typeof selected !== 'function' && typeof selected.view === 'object'
                ? selected.view
                : undefined;
            this.activeDestroy = selectedView?.destroy
                ? {receiver: selectedView, callback: selectedView.destroy}
                : undefined;
        }
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
