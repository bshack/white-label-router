"use strict";
/** History API router with ordered path-boundary matching. */
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
    /**
     * Create an instance with its own state and listener references.
     */
    constructor() {
        // placeholder for routes defined when extended
        this.routes = {
            defaultRoute: {
                view: {
                    initialize: () => {
                        return true;
                    },
                    destroy: () => {
                        return true;
                    }
                }
            }
        };
        // this will hold the current url
        this.url = '';
        // this holds the current route
        this.route = null;
        // can house a container for the router to act upon
        this.scope = null;
        // this holds the previous route for destorying later
        this.previousRoute = null;
        // this will hold the page title (not yet supported by browsers)
        this.pageTitle = null;
        // optional mediator placeholder
        this.mediator = false;
        // Stable listener references allow destroy() to release browser resources.
        this.boundPushStateClick = this.eventPushStateClick.bind(this);
        this.boundPopState = this.eventPopState.bind(this);
        this.boundMediatorNavigate = (data = {}) => {
            this.navigate(data.url, data, false);
        };
        this.listenersInitialized = false;
    }
    /**
     * Start this instance and return it for lifecycle chaining.
     * @returns This instance for chaining.
     */
    initialize() {
        //get the url fragment w/query string
        this.url = window.location.pathname + window.location.search + (window.location.hash || '');
        // set up the events
        this.addListeners();
        // navigate to correct view
        this.navigate(undefined, {}, true);
        return this;
    }
    /**
     * Register stable document, history, and optional mediator handlers once.
     * @returns This instance for chaining.
     */
    addListeners() {
        if (this.listenersInitialized) {
            return this;
        }
        // Delegate push-state links from one document listener.
        document.addEventListener('click', this.boundPushStateClick);
        //bind window popstates
        window.addEventListener('popstate', this.boundPopState);
        //listen to a mediator if present
        if (this.mediator) {
            this.mediator.on('router:navigate', this.boundMediatorNavigate);
        }
        this.listenersInitialized = true;
        return this;
    }
    /**
     * Release owned state and listeners so the instance can leave the application lifecycle.
     * @returns This instance after cleanup.
     */
    destroy() {
        this.removeListeners();
        return this;
    }
    /**
     * Release listeners owned by this instance; subclasses may extend the lifecycle hook.
     * @returns This instance for chaining.
     */
    removeListeners() {
        if (!this.listenersInitialized) {
            return this;
        }
        // Unbind the same stable listener objects registered by addListeners().
        document.removeEventListener('click', this.boundPushStateClick);
        //bind window popstates
        window.removeEventListener('popstate', this.boundPopState);
        if (this.mediator) {
            this.mediator.removeListener('router:navigate', this.boundMediatorNavigate);
        }
        this.listenersInitialized = false;
        return this;
    }
    /**
     * Intercept eligible same-origin push-state links while preserving normal browser actions.
     * @param e - Browser event being handled.
     * @returns True when the browser should handle the event, or this router after interception.
     */
    eventPushStateClick(e) {
        if (e.defaultPrevented ||
            (e.button !== undefined && e.button !== 0) ||
            e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
            return true;
        }
        const eventTarget = e.target;
        const source = eventTarget && (typeof eventTarget.closest === 'function' ? eventTarget : eventTarget.parentElement);
        const anchor = source && typeof source.closest === 'function'
            ? source.closest('a[href][data-pushstate]')
            : null;
        if (!anchor) {
            return true;
        }
        const target = anchor.getAttribute('target');
        if (anchor.hasAttribute('download') ||
            (target && target.toLowerCase() !== '_self')) {
            return true;
        }
        const location = new URL(anchor.getAttribute('href') || '', window.location.href || `${window.location.origin}/`);
        if (location.origin !== window.location.origin) {
            return true;
        }
        e.preventDefault();
        // closest() supports nested elements at any depth inside the selected anchor.
        this.url = `${location.pathname}${location.search}${location.hash}`;
        this.navigate(undefined, {}, false);
        return this;
    }
    /**
     * Restore browser history state without adding a new history entry.
     * @param e - Browser event being handled.
     * @returns This router after restoring the history state.
     */
    eventPopState(e) {
        // History state belongs to the embedding application; the URL is authoritative.
        this.url = window.location.pathname + window.location.search + (window.location.hash || '');
        this.navigate(undefined, {}, true);
        return this;
    }
    /**
     * Decode URL query parameters, keeping the last value for duplicate keys.
     * @param queryString - Encoded URL query portion.
     * @returns A record of decoded query names and their final values.
     */
    parseQueryString(queryString) {
        return Object.fromEntries(new URLSearchParams(queryString));
    }
    /**
     * Build decoded path, query, and mediator data for the selected route.
     * @param mediatorData - Optional caller metadata passed to the route.
     * @returns No value; locationData is updated in place.
     */
    setLocationData(mediatorData) {
        const parsedUrl = new URL(this.url, window.location.origin);
        const matchedRoute = this.route && this.route !== 'defaultRoute' ? this.route : '';
        // this is the object passed to the matching view
        this.locationData = {
            url: this.url,
            data: {
                url: [],
                mediator: mediatorData,
                query: {}
            }
        };
        // parse out the url data
        this.locationData.data.url = parsedUrl.pathname
            .slice(matchedRoute.length)
            .split('/')
            .filter(Boolean)
            .map((fragment) => {
            try {
                return decodeURIComponent(fragment);
            }
            catch (error) {
                return fragment;
            }
        });
        //add query string data
        this.locationData.data.query = this.parseQueryString(parsedUrl.search);
    }
    /**
     * Update page context after a route renders.
     * @param route - Selected route configuration.
     * @returns This router after applying title and optional focus.
     */
    applyPageContext(route) {
        if (typeof route === 'function') {
            this.pageTitle = null;
            return this;
        }
        this.pageTitle = typeof route.title === 'string' ? route.title : null;
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
    /**
     * Select a route, enforce its guard, transition view lifecycles, and update history and title.
     * @param url - URL or optional adapter argument.
     * @param mediatorData - Optional caller metadata passed to the route.
     * @param isPopState - Whether navigation came from browser history.
     * @returns False when a guard or route rejects navigation; otherwise this router.
     */
    navigate(url, mediatorData, isPopState = false) {
        // allow navigate to use a specified url
        if (url) {
            this.url = url;
        }
        //clean up url for matching
        this.url = this.url.replace(window.location.origin, '');
        // reset this to null for new location
        this.route = null;
        const pathname = new URL(this.url, window.location.origin).pathname;
        // Match complete path segments so /page2 does not also match /page23.
        for (const route in this.routes) {
            if (route !== 'defaultRoute' &&
                (pathname === route || pathname.startsWith(`${route}/`))) {
                this.route = route;
                //stop looping we are done
                break;
            }
        }
        this.setLocationData(mediatorData);
        // if a catch all default route is defined execute that when not match is found
        if (!this.route && this.routes.defaultRoute) {
            this.route = 'defaultRoute';
        }
        if (this.route) {
            const selected = this.routes[this.route];
            if (typeof selected !== 'function' && selected.secure &&
                selected.secure(this.scope, this.locationData) !== true) {
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
        // make sure to not set pushstate on back button click
        if (!isPopState) {
            //set in history the new url
            window.history.pushState(this.url, this.pageTitle || '', this.url);
        }
        // since browsers don't support setting the title with pushstate yet
        return this;
    }
}
;
module.exports = Router;
//# sourceMappingURL=index.js.map