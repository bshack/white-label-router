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
/** History API router with ordered path-boundary matching and a server-safe runtime. */
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
    constructor();
    /** Start this instance. On a server, pass the request URL. */
    initialize(url?: string): this;
    /** Register stable browser and optional mediator handlers once. */
    addListeners(): this;
    destroy(): this;
    /** Release listeners owned by this instance. */
    removeListeners(): this;
    eventPushStateClick(e: MouseEvent): true | this;
    eventPopState(_e: PopStateEvent): this;
    parseQueryString(queryString: string): {
        [k: string]: string;
    };
    private parseUrl;
    /** Normalize absolute and relative input to an application URL. */
    private normalizeUrl;
    setLocationData(mediatorData?: NavigationData): void;
    applyPageContext(route: Route): this;
    navigate(url?: string, mediatorData?: NavigationData, isPopState?: boolean): false | this;
}
declare namespace Router {
    type Handler = RouteHandler;
    type Route = RouteHandler | RouteObject;
    type Location = LocationData;
    type Navigation = NavigationData;
}
export = Router;
