// event delegation lib
import Gator from 'gator';

(() => {
    'use strict';
    module.exports = class {
        constructor() {
            // placeholder for routes defined when extended
            this.routes = {};
            // this will hold the current url
            this.url = '';
        }
        initialize() {
            //get the url fragment
            this.url = (window.location.pathname || '');
            // set up the events
            this.addListeners();
            //add inital url to state
            window.history.pushState(this.url, null, this.url);
            // check to see if any logic is associated with the current url
            this.runRoute(this.url);
            return this;
        }
        addListeners() {
            //bind ot all pushstate links
            Gator(document).on('click', '[data-pushstate]',
                this.eventPushStateClick.bind(this));
            //bind window popstates
            window
                .addEventListener('popstate', this.eventPopState.bind(this));
            return this;
        }
        eventPushStateClick(e) {
            e.preventDefault();
            this.url = e.target.getAttribute('href') || '';
            this.runRoute(this.url);
            window.history.pushState(this.url, null, this.url);
            return this;
        }
        eventPopState(e) {
            this.url = (e.state || '');
            this.runRoute(this.url);
            window.history.pushState(this.url, null, this.url);
            return this;
        }
        navigate(url) {
            this.url = (url || '');
            this.runRoute(this.url);
            window.history.pushState(this.url, null, this.url);
            return this;
        }
        runRoute() {
            // if that route is defined then execute it
            if (this.routes[this.url]) {
                this.routes[this.url]();
            // else if a catch all default route is defined execute that
            } else if (this.routes.defaultRoute) {
                this.routes.defaultRoute();
            }
            return this;
        }
        destroy() {
            return this;
        }
        removeListeners() {
            return this;
        }
        render() {
            return this;
        }
    };
})();
