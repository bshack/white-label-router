// event delegation lib
import Gator from 'gator';

(() => {
    'use strict';
    module.exports = class {
        constructor() {
            // placeholder for routes defined when extended
            this.routes = {
                defaultRoute: () => {
                    return this;
                }
            };
            // this will hold the current url
            this.url = '';
        }
        initialize() {
            //get the url fragment
            this.url = (window.location.pathname || '');
            // set up the events
            this.addListeners();
            // navigate to correct view
            this.navigate();
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
            this.navigate();
            return this;
        }
        eventPopState(e) {
            this.url = (e.state || '');
            this.navigate();
            return this;
        }
        navigate(url) {
            if (url) {
                this.url = (url || '');
            }
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
