"use strict";
const hasBrowserRuntime = () => typeof window !== 'undefined' && typeof document !== 'undefined';
/** History API router with ordered path-boundary matching and a server-safe runtime. */
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
    /** Start this instance. On a server, pass the request URL. */
    initialize(url) {
        if (url !== undefined) {
            this.url = url;
        }
        else if (hasBrowserRuntime()) {
            this.url = window.location.pathname + window.location.search + (window.location.hash || '');
        }
        else if (!this.url) {
            this.url = '/';
        }
        this.addListeners();
        this.navigate(undefined, {}, true);
        return this;
    }
    /** Register stable browser and optional mediator handlers once. */
    addListeners() {
        if (this.listenersInitialized) {
            return this;
        }
        if (hasBrowserRuntime()) {
            document.addEventListener('click', this.boundPushStateClick);
            window.addEventListener('popstate', this.boundPopState);
        }
        if (this.mediator) {
            this.mediator.on('router:navigate', this.boundMediatorNavigate);
        }
        this.listenersInitialized = true;
        return this;
    }
    destroy() {
        this.removeListeners();
        return this;
    }
    /** Release listeners owned by this instance. */
    removeListeners() {
        if (!this.listenersInitialized) {
            return this;
        }
        if (hasBrowserRuntime()) {
            document.removeEventListener('click', this.boundPushStateClick);
            window.removeEventListener('popstate', this.boundPopState);
        }
        if (this.mediator) {
            this.mediator.removeListener('router:navigate', this.boundMediatorNavigate);
        }
        this.listenersInitialized = false;
        return this;
    }
    eventPushStateClick(e) {
        if (!hasBrowserRuntime()) {
            return true;
        }
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
    eventPopState(_e) {
        if (!hasBrowserRuntime()) {
            return this;
        }
        this.url = window.location.pathname + window.location.search + (window.location.hash || '');
        this.navigate(undefined, {}, true);
        return this;
    }
    parseQueryString(queryString) {
        return Object.fromEntries(new URLSearchParams(queryString));
    }
    parseUrl(url) {
        const base = hasBrowserRuntime() ? window.location.origin : 'http://localhost';
        return new URL(url || '/', base);
    }
    /** Normalize absolute and relative input to an application URL. */
    normalizeUrl(url) {
        const parsed = this.parseUrl(url);
        return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
    }
    setLocationData(mediatorData) {
        const parsedUrl = this.parseUrl(this.url);
        const matchedRoute = this.route && this.route !== 'defaultRoute' ? this.route : '';
        this.locationData = {
            url: this.url,
            data: { url: [], mediator: mediatorData, query: {} }
        };
        this.locationData.data.url = parsedUrl.pathname
            .slice(matchedRoute.length)
            .split('/')
            .filter(Boolean)
            .map(fragment => {
            try {
                return decodeURIComponent(fragment);
            }
            catch (_error) {
                return fragment;
            }
        });
        this.locationData.data.query = this.parseQueryString(parsedUrl.search);
    }
    applyPageContext(route) {
        if (typeof route === 'function') {
            this.pageTitle = null;
            return this;
        }
        this.pageTitle = typeof route.title === 'string' ? route.title : null;
        if (!hasBrowserRuntime()) {
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
    navigate(url, mediatorData, isPopState = false) {
        if (url !== undefined) {
            this.url = url;
        }
        this.url = this.normalizeUrl(this.url || '/');
        this.route = null;
        const pathname = this.parseUrl(this.url).pathname;
        for (const route in this.routes) {
            if (route !== 'defaultRoute' && (pathname === route || pathname.startsWith(`${route}/`))) {
                this.route = route;
                break;
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
        if (!isPopState && hasBrowserRuntime()) {
            window.history.pushState(this.url, this.pageTitle || '', this.url);
        }
        return this;
    }
}
module.exports = Router;
//# sourceMappingURL=index.js.map