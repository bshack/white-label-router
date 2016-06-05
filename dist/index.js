(function (global, factory) {
    if (typeof define === "function" && define.amd) {
        define(['module', 'gator'], factory);
    } else if (typeof exports !== "undefined") {
        factory(module, require('gator'));
    } else {
        var mod = {
            exports: {}
        };
        factory(mod, global.gator);
        global.index = mod.exports;
    }
})(this, function (module, _gator) {
    'use strict';

    var _gator2 = _interopRequireDefault(_gator);

    function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : {
            default: obj
        };
    }

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
            function _class() {
                var _this = this;

                _classCallCheck(this, _class);

                // placeholder for routes defined when extended
                this.routes = {
                    defaultRoute: function defaultRoute() {
                        return _this;
                    }
                };
                // this will hold the current url
                this.url = '';
            }

            _createClass(_class, [{
                key: 'initialize',
                value: function initialize() {
                    //get the url fragment
                    this.url = window.location.pathname || '';
                    // set up the events
                    this.addListeners();
                    // navigate to correct view
                    this.navigate();
                    return this;
                }
            }, {
                key: 'addListeners',
                value: function addListeners() {
                    //bind ot all pushstate links
                    (0, _gator2.default)(document).on('click', '[data-pushstate]', this.eventPushStateClick.bind(this));
                    //bind window popstates
                    window.addEventListener('popstate', this.eventPopState.bind(this));
                    return this;
                }
            }, {
                key: 'eventPushStateClick',
                value: function eventPushStateClick(e) {
                    e.preventDefault();
                    this.url = e.target.getAttribute('href') || '';
                    this.navigate();
                    return this;
                }
            }, {
                key: 'eventPopState',
                value: function eventPopState(e) {
                    this.url = e.state || '';
                    this.navigate();
                    return this;
                }
            }, {
                key: 'navigate',
                value: function navigate(url) {
                    if (url) {
                        this.url = url || '';
                    }
                    this.runRoute(this.url);
                    window.history.pushState(this.url, null, this.url);
                    return this;
                }
            }, {
                key: 'runRoute',
                value: function runRoute() {
                    // if that route is defined then execute it
                    if (this.routes[this.url]) {
                        this.routes[this.url]();
                        // else if a catch all default route is defined execute that
                    } else if (this.routes.defaultRoute) {
                            this.routes.defaultRoute();
                        }
                    return this;
                }
            }, {
                key: 'destroy',
                value: function destroy() {
                    return this;
                }
            }, {
                key: 'removeListeners',
                value: function removeListeners() {
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
