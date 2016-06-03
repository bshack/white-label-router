(() => {
    'use strict';
    module.exports = class {
        constructor() {
            // placeholder for routes defined when extended
            this.routes = {};
        }
        initialize() {
            // set up the events
            this.addListeners();
            // check to see if any logic is associated with the current hash
            this.checkRoute();
            return this;
        }
        addListeners() {
            // on hash change check to see if there is any defined logic for it
            window.addEventListener('hashchange', () => {
                this.checkRoute();
            });
            return this;
        }
        checkRoute(callback) {
            // what is the current hash value?
            let hashCleanedString = window.location.hash.substr(1);
            // if that route is defined then execute it
            if (this.routes[hashCleanedString]) {
                this.routes[hashCleanedString]();
            // else if a catch all default route is defined execute that
            } else if (this.routes.defaultRoute) {
                this.routes.defaultRoute();
            }
            // if there is a callback defined call it with he current hash value
            if (callback) {
                callback(hashCleanedString);
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
