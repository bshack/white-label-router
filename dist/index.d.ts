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
    removeListener?(event: string, callback: (data?: NavigationData) => unknown): unknown;
}
/** History API router with ordered path-boundary matching. */
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
    /**
     * Create an instance with its own state and listener references.
     */
    constructor();
    /**
     * Start this instance and return it for lifecycle chaining.
     * @returns This instance for chaining.
     */
    initialize(): this;
    /**
     * Register stable document, history, and optional mediator handlers once.
     * @returns This instance for chaining.
     */
    addListeners(): this;
    /**
     * Release owned state and listeners so the instance can leave the application lifecycle.
     * @returns This instance after cleanup.
     */
    destroy(): this;
    /**
     * Release listeners owned by this instance; subclasses may extend the lifecycle hook.
     * @returns This instance for chaining.
     */
    removeListeners(): this;
    /**
     * Intercept eligible same-origin push-state links while preserving normal browser actions.
     * @param e - Browser event being handled.
     * @returns True when the browser should handle the event, or this router after interception.
     */
    eventPushStateClick(e: MouseEvent): true | this;
    /**
     * Restore browser history state without adding a new history entry.
     * @param e - Browser event being handled.
     * @returns This router after restoring the history state.
     */
    eventPopState(e: PopStateEvent): this;
    /**
     * Decode URL query parameters, keeping the last value for duplicate keys.
     * @param queryString - Encoded URL query portion.
     * @returns A record of decoded query names and their final values.
     */
    parseQueryString(queryString: string): {
        [k: string]: string;
    };
    /**
     * Build decoded path, query, and mediator data for the selected route.
     * @param mediatorData - Optional caller metadata passed to the route.
     * @returns No value; locationData is updated in place.
     */
    setLocationData(mediatorData?: NavigationData): void;
    /**
     * Select a route, enforce its guard, transition view lifecycles, and update history and title.
     * @param url - URL or optional adapter argument.
     * @param mediatorData - Optional caller metadata passed to the route.
     * @param isPopState - Whether navigation came from browser history.
     * @returns False when a guard or route rejects navigation; otherwise this router.
     */
    navigate(url?: string | false, mediatorData?: NavigationData, isPopState?: boolean): false | this;
}
/** Public route configuration and navigation payload types. */
declare namespace Router {
    type Handler = RouteHandler;
    type Route = RouteHandler | RouteObject;
    type Location = LocationData;
    type Navigation = NavigationData;
}
export = Router;
