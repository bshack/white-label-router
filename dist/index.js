"use strict";
/** History API router that also dispatches request URLs in non-browser runtimes. */
class Router {
    routes;
    url;
    route;
    scope;
    previousRoute;
    pageTitle;
    mediator;
    boundPushStateClick;
    boundPopState;
    boundMediatorNavigate;
    listenersInitialized;
    locationData = { url: '', data: { url: [], mediator: undefined, query: {} } };
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
        this.mediator = false;
        this.boundPushStateClick = this.eventPushStateClick.bind(this);
        this.boundPopState = this.eventPopState.bind(this);
        this.boundMediatorNavigate = (data = {}) => {
            this.navigate(data.url, data, false);
        };
        this.listenersInitialized = false;
    }
    /** True when browser navigation APIs are available. */
    isBrowserRuntime() {
        return typeof window !== 'undefined' && typeof document !== 'undefined';
    }
    /** Stable base URL for WHATWG URL parsing in browser and server runtimes. */
    getOrigin() {
        return this.isBrowserRuntime() ? window.location.origin : 'http://white-label.invalid';
    }
    /** Read the authoritative browser URL, or retain the supplied server URL. */
    getCurrentUrl() {
        if (!this.isBrowserRuntime()) {
            return this.url || '/';
        }
        return window.location.pathname + window.location.search + (window.location.hash || '');
    }
    /** Normalize browser navigation to a same-origin path, query, and hash. */
    normalizeBrowserUrl(url) {
        if (!this.isBrowserRuntime()) {
            return url;
        }
        const parsedUrl = new URL(url || '/', window.location.href || `${window.location.origin}/`);
        if (parsedUrl.origin !== window.location.origin) {
            return null;
        }
        return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
    }
    /**
     * Start this instance and return it for lifecycle chaining.
     * In a browser the URL is optional and defaults to window.location. On a server pass the request URL.
     */
    initialize(url) {
        this.url = url ?? this.getCurrentUrl();
        this.addListeners();
        this.navigate(undefined, {}, true);
        return this;
    }
    /** Register browser and optional mediator handlers once. */
    addListeners() {
        if (this.listenersInitialized) {
            return this;
        }
        if (this.isBrowserRuntime()) {
            document.addEventListener('click', this.boundPushStateClick);
            window.addEventListener('popstate', this.boundPopState);
        }
        if (this.mediator) {
            this.mediator.on('router:navigate', this.boundMediatorNavigate);
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
        if (!this.listenersInitialized) {
            return this;
        }
        if (this.isBrowserRuntime()) {
            document.removeEventListener('click', this.boundPushStateClick);
            window.removeEventListener('popstate', this.boundPopState);
        }
        if (this.mediator) {
            this.mediator.removeListener('router:navigate', this.boundMediatorNavigate);
        }
        this.listenersInitialized = false;
        return this;
    }
    /** Intercept eligible same-origin push-state links while preserving normal browser actions. */
    eventPushStateClick(e) {
        if (typeof window === 'undefined') {
            return true;
        }
        if (e.defaultPrevented || (e.button !== undefined && e.button !== 0) || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
            return true;
        }
        const eventTarget = e.target;
        const source = eventTarget && (typeof eventTarget.closest === 'function' ? eventTarget : eventTarget.parentElement);
        const anchor = source && typeof source.closest === 'function' ? source.closest('a[href][data-pushstate]') : null;
        if (!anchor) {
            return true;
        }
        const target = anchor.getAttribute('target');
        if (anchor.hasAttribute('download') || (target && target.toLowerCase() !== '_self')) {
            return true;
        }
        const location = new URL(anchor.getAttribute('href') || '', window.location.href || `${window.location.origin}/`);
        if (location.origin !== window.location.origin) {
            return true;
        }
        e.preventDefault();
        this.url = `${location.pathname}${location.search}${location.hash}`;
        this.navigate(undefined, {}, false);
        return this;
    }
    /** Restore browser history state without adding a new history entry. */
    eventPopState() {
        if (typeof window === 'undefined') {
            return this;
        }
        this.url = this.getCurrentUrl();
        this.navigate(undefined, {}, true);
        return this;
    }
    /** Decode URL query parameters, keeping the last value for duplicate keys. */
    parseQueryString(queryString) {
        return Object.fromEntries(new URLSearchParams(queryString));
    }
    /** Build decoded path, query, and mediator data for the selected route. */
    setLocationData(mediatorData) {
        const parsedUrl = new URL(this.url || '/', this.getOrigin());
        const matchedRoute = this.route && this.route !== 'defaultRoute' ? this.route : '';
        this.locationData = {
            url: this.url,
            data: { url: [], mediator: mediatorData, query: {} }
        };
        this.locationData.data.url = parsedUrl.pathname
            .slice(matchedRoute.length)
            .split('/')
            .filter(Boolean)
            .map((fragment) => {
            try {
                return decodeURIComponent(fragment);
            }
            catch (_error) {
                return fragment;
            }
        });
        this.locationData.data.query = this.parseQueryString(parsedUrl.search);
    }
    /** Update page context after a route renders. DOM effects are browser-only. */
    applyPageContext(route) {
        if (typeof route === 'function') {
            this.pageTitle = null;
            return this;
        }
        this.pageTitle = typeof route.title === 'string' ? route.title : null;
        if (!this.isBrowserRuntime()) {
            return this;
        }
        if (this.pageTitle) {
            document.title = this.pageTitle;
        }
        if (route.focus !== false) {
            const target = document.querySelector(route.focus || 'main h1');
            if (target) {
                if (!target.hasAttribute('tabindex')) {
                    target.setAttribute('tabindex', '-1');
                }
                target.focus();
            }
        }
        return this;
    }
    /** Select a route, enforce its guard, transition view lifecycles, and update browser history when available. */
    navigate(url, mediatorData, isPopState = false) {
        if (url !== undefined) {
            this.url = url;
        }
        if (!this.url) {
            this.url = this.getCurrentUrl();
        }
        const normalizedUrl = this.normalizeBrowserUrl(this.url);
        if (normalizedUrl === null) {
            return false;
        }
        this.url = normalizedUrl;
        this.route = null;
        const pathname = new URL(this.url, this.getOrigin()).pathname;
        for (const route in this.routes) {
            if (route === 'defaultRoute' || (pathname !== route && !pathname.startsWith(`${route}/`))) {
                continue;
            }
            if (!this.route || route.length > this.route.length) {
                this.route = route;
            }
        }
        this.setLocationData(mediatorData);
        if (!this.route && this.routes.defaultRoute) {
            this.route = 'defaultRoute';
        }
        if (this.route) {
            const selected = this.routes[this.route];
            if (typeof selected !== 'function' && selected.secure && selected.secure(this.scope, this.locationData) !== true) {
                return false;
            }
            const previous = this.previousRoute ? this.routes[this.previousRoute] : undefined;
            if (previous && typeof previous !== 'function' && typeof previous.view === 'object' && previous.view.destroy) {
                previous.view.destroy(this.scope, this.locationData);
            }
            if (typeof selected === 'function') {
                selected(this.scope, this.locationData);
            }
            else if (typeof selected.view === 'function') {
                selected.view(this.scope, this.locationData);
            }
            else if (selected.view && typeof selected.view.initialize === 'function') {
                selected.view.initialize(this.scope, this.locationData);
            }
            else {
                return false;
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
module.exports = Router;
//# sourceMappingURL=index.js.map