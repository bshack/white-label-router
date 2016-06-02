(() => {
    'use strict';
    module.exports = class {
        constructor(routes) {
            this.routes = routes || {};
        }
        initialize() {
            this.addListeners();
            this.checkRoute();
            return this;
        }
        addListeners() {
            window.addEventListener('hashchange', (e) => {
                this.checkRoute();
            });
            return this;
        }
        checkRoute(callback) {
            let hashCleanedString = window.location.hash.substr(1);
            if (this.routes[hashCleanedString]) {
                this.routes[hashCleanedString]();
            }
            if (callback) {
                callback(hashCleanedString);
            }
            return this;
        }
        destroy() {
            return this;
        }
        render() {
            return this;
        }
    };
})();
