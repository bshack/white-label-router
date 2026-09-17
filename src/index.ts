/** Navigation payload, including caller-defined metadata. */
interface NavigationData {url?: string; [key: string]: unknown}
/** URL-derived values supplied to route handlers. */
interface LocationData {url: string; data: {url: string[]; mediator: NavigationData | undefined; query: Record<string, string>}}
type RouteHandler = (scope: Element | null, location: LocationData) => unknown;
/** An object route can own a function or a view lifecycle. */
interface RouteObject {title?: string; focus?: string | false; secure?: RouteHandler; view?: RouteHandler | {initialize?: RouteHandler; destroy?: RouteHandler}}
type Route = RouteHandler | RouteObject;
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
            const data = (event as CustomEvent<NavigationData | undefined>).detail ?? {};
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

    /** Normalize browser navigation to a same-origin path, query, and hash. */
    private normalizeBrowserUrl(url: string) {
        if (!this.isBrowserRuntime()) {return url;}
        const parsedUrl = new URL(url || '/', window.location.href || `${window.location.origin}/`);
        if (parsedUrl.origin !== window.location.origin) {return null;}
        return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
    }

    /** Return whether a selected route has runnable view behavior. */
    private isRunnableRoute(route: Route): boolean {
        return typeof route === 'function' || typeof route.view === 'function' ||
            Boolean(route.view && typeof route.view.initialize === 'function');
    }

    /**
     * Start this instance and return it for lifecycle chaining.
     * In a browser the URL is optional and defaults to window.location. On a server pass the request URL.
     */
    initialize(url?: string) {
        this.url = url ?? this.getCurrentUrl();
        this.addListeners();
        this.navigate(undefined, {}, true);
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
        const location = new URL(anchor.getAttribute('href') || '', window.location.href || `${window.location.origin}/`);
        if (location.origin !== window.location.origin) {return true;}
        e.preventDefault();
        this.navigate(`${location.pathname}${location.search}${location.hash}`, {}, false);
        return this;
    }

    /** Restore browser history state without adding a new history entry. */
    eventPopState() {
        if (typeof window === 'undefined') {return this;}
        this.url = this.getCurrentUrl();
        this.navigate(undefined, {}, true);
        return this;
    }

    /** Decode URL query parameters, keeping the last value for duplicate keys. */
    parseQueryString(queryString: string) {
        return Object.fromEntries(new URLSearchParams(queryString));
    }

    /** Build decoded path, query, and mediator data for the selected route. */
    setLocationData(mediatorData?: NavigationData) {
        const parsedUrl = new URL(this.url || '/', this.getOrigin());
        const matchedRoute = this.route && this.route !== 'defaultRoute' ? this.route : '';
        this.locationData = {
            url: this.url,
            data: {url: [], mediator: mediatorData, query: {}}
        };
        this.locationData.data.url = parsedUrl.pathname
            .slice(matchedRoute.length)
            .split('/')
            .filter(Boolean)
            .map((fragment) => {
                try {return decodeURIComponent(fragment);} catch (_error) {return fragment;}
            });
        this.locationData.data.query = this.parseQueryString(parsedUrl.search);
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
        const previousUrl = this.url;
        const previousSelectedRoute = this.route;
        const previousLocationData = this.locationData;
        if (url !== undefined) {this.url = url;}
        if (!this.url) {this.url = this.getCurrentUrl();}
        const normalizedUrl = this.normalizeBrowserUrl(this.url);
        if (normalizedUrl === null) {
            this.url = previousUrl;
            return false;
        }
        this.url = normalizedUrl;
        this.route = null;
        const pathname = new URL(this.url, this.getOrigin()).pathname;
        for (const route of Object.keys(this.routes)) {
            if (route === 'defaultRoute' || (pathname !== route && !pathname.startsWith(`${route}/`))) {continue;}
            if (!this.route || route.length > this.route.length) {this.route = route;}
        }
        this.setLocationData(mediatorData);
        if (!this.route && this.routes.defaultRoute) {this.route = 'defaultRoute';}
        if (this.route) {
            const selected = this.routes[this.route]!;
            if ((typeof selected !== 'function' && selected.secure && selected.secure(this.scope, this.locationData) !== true) ||
                !this.isRunnableRoute(selected)) {
                this.url = previousUrl;
                this.route = previousSelectedRoute;
                this.locationData = previousLocationData;
                return false;
            }
            const previous = this.previousRoute ? this.routes[this.previousRoute] : undefined;
            if (previous && typeof previous !== 'function' && typeof previous.view === 'object' && previous.view.destroy) {
                previous.view.destroy(this.scope, this.locationData);
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
        }
        if (!isPopState && this.isBrowserRuntime()) {
            window.history.pushState(this.url, this.pageTitle || '', this.url);
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
