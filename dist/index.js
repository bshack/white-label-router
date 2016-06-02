(function (global, factory) {
    if (typeof define === "function" && define.amd) {
        define(['module'], factory);
    } else if (typeof exports !== "undefined") {
        factory(module);
    } else {
        var mod = {
            exports: {}
        };
        factory(mod);
        global.index = mod.exports;
    }
})(this, function (module) {
    'use strict';

    function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
        }
    }

    var _createClass = function () {
        function defineProperties(target, props) {
            for (var i = 0; i < props.length; i++) {
                var descriptor = props[i];
                descriptor.enumerable = descriptor.enumerable || false;
                descriptor.configurable = true;
                if ("value" in descriptor) descriptor.writable = true;
                Object.defineProperty(target, descriptor.key, descriptor);
            }
        }

        return function (Constructor, protoProps, staticProps) {
            if (protoProps) defineProperties(Constructor.prototype, protoProps);
            if (staticProps) defineProperties(Constructor, staticProps);
            return Constructor;
        };
    }();

    (function () {
        'use strict';

        module.exports = function () {
            function _class(routes) {
                _classCallCheck(this, _class);

                // when initialized set the routes if defined
                this.routes = routes || {};
            }

            _createClass(_class, [{
                key: 'initialize',
                value: function initialize() {
                    // set up the events
                    this.addListeners();
                    // check to see if any logic is associated with the current hash
                    this.checkRoute();
                    return this;
                }
            }, {
                key: 'addListeners',
                value: function addListeners() {
                    var _this = this;

                    // on hash change check to see if there is any defined logic for it
                    window.addEventListener('hashchange', function (e) {
                        _this.checkRoute();
                    });
                    return this;
                }
            }, {
                key: 'checkRoute',
                value: function checkRoute(callback) {
                    // what is the current hash value?
                    var hashCleanedString = window.location.hash.substr(1);
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
            }, {
                key: 'destroy',
                value: function destroy() {
                    return this;
                }
            }, {
                key: 'render',
                value: function render() {
                    return this;
                }
            }]);

            return _class;
        }();
    })();
});
