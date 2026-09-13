/** Navigation payload, including caller-defined metadata. */
interface NavigationData {
    url?: string;
    [key: string]: unknown;
}
/** URL-derived values supplied to route handlers. */
interface LocationData {
    url: string;
    data: {
        url: string[];
        mediator: NavigationData | undefined;
        query: Record<string, string>;
    };
}
type RouteHandler = (scope: Element | null, location: LocationData) => unknown;
/** An object route can own a function or a view lifecycle. */
interface RouteObject {
    title?: string;
    focus?: string | false;
    secure?: RouteHandler;
    view?: RouteHandler | {
        initialize?: RouteHandler;
        destroy?: RouteHandler;
    };
}
type Route = RouteHandler | RouteObject;
/** Minimal event-bus contract required by the router. */
interface NavigationMediator {
    on(event: string, callback: (data?: NavigationData) => unknown): unknown;
    removeListener(event: string, callback: (data?: NavigationData) => unknown): unknown;
}
/** History API router that also dispatches request URLs in non-browser runtimes. */
declare class Router {
    routes: Record<string, Route>;
    url: string;
    route: string | null;
    scope: Element | null;
    previousRoute: string | null;
    pageTitle: string | null;
    mediator: NavigationMediator | false;
    boundPushStateClick: (event: MouseEvent) => unknown;
    boundPopState: (event: PopStateEvent) => unknown;
    boundMediatorNavigate: (data?: NavigationData) => unknown;
    listenersInitialized: boolean;
    locationData: LocationData;
    /** Create an instance with its own state and listener references. */
    constructor();
    /** True when browser navigation APIs are available. */
    private isBrowserRuntime;
    /** Stable base URL for WHATWG URL parsing in browser and server runtimes. */
    private getOrigin;
    /** Read the authoritative browser URL, or retain the supplied server URL. */
    private getCurrentUrl;
    /** Normalize browser navigation to a same-origin path, query, and hash. */
    private normalizeBrowserUrl;
    /**
     * Start this instance and return it for lifecycle chaining.
     * In a browser the URL is optional and defaults to window.location. On a server pass the request URL.
     */
    initialize(url?: string): this;
    /** Register browser and optional mediator handlers once. */
    addListeners(): this;
    /** Release owned state and listeners so the instance can leave the application lifecycle. */
    destroy(): this;
    /** Release listeners owned by this instance; subclasses may extend the lifecycle hook. */
    removeListeners(): this;
    /** Intercept eligible same-origin push-state links while preserving normal browser actions. */
    eventPushStateClick(e: MouseEvent): true | this;
    /** Restore browser history state without adding a new history entry. */
    eventPopState(): this;
    /** Decode URL query parameters, keeping the last value for duplicate keys. */
    parseQueryString(queryString: string): {
        [k: string]: string;
    };
    /** Build decoded path, query, and mediator data for the selected route. */
    setLocationData(mediatorData?: NavigationData): void;
    /** Update page context after a route renders. DOM effects are browser-only. */
    applyPageContext(route: Route): this;
    /** Select a route, enforce its guard, transition view lifecycles, and update browser history when available. */
    navigate(url?: string, mediatorData?: NavigationData, isPopState?: boolean): false | this;
}
/** Public route configuration and navigation payload types. */
declare namespace Router {
    type Handler = RouteHandler;
    type Route = RouteHandler | RouteObject;
    type Location = LocationData;
    type Navigation = NavigationData;
}
export = Router;
