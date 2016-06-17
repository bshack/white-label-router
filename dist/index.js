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
                // optional mediator placeholder
                this.mediator = false;
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
                    var _this2 = this;

                    //bind all pushstate links
                    (0, _gator2.default)(document).on('click', '[data-pushstate]', this.eventPushStateClick.bind(this));
                    //bind window popstates
                    window.addEventListener('popstate', this.eventPopState.bind(this));
                    //listen to a mediator if present
                    if (this.mediator) {
                        this.mediator.on('router:navigate', function (url) {
                            _this2.navigate(url);
                        });
                    }
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

                    // default to false, status of if we have an route matching the url
                    var matcher = false;

                    // allow navigate to use a specified url
                    if (url) {
                        this.url = url;
                    }

                    // this is the object passed to the matching view
                    this.locationData = {
                        url: this.url,
                        data: []
                    };

                    //find the first matcher that starts with the same string as a defined route
                    for (var route in this.routes) {
                        if (this.url.lastIndexOf(route, 0) === 0) {
                            // parse out the url data
                            this.locationData.data = this.url.replace(route, '').split('/');
                            this.locationData.data.splice(0, 1);
                            // remove any trailing empty items from the array
                            if (this.locationData.data.length && this.locationData.data[this.locationData.data.length - 1] === '') {
                                this.locationData.data.splice(this.locationData.data.length - 1, 1);
                            }
                            //execute the route
                            this.routes[route](this.locationData);
                            //set that we have found a match
                            matcher = true;
                            //stop looping we are done
                            break;
                        }
                    }
                    // else if a catch all default route is defined execute that
                    if (matcher === false && this.routes.defaultRoute) {
                        this.routes.defaultRoute(this.locationData);
                    }
                    //set in history the new url
                    window.history.pushState(this.url, null, this.url);
                    return this;
                }
            }, {
                key: 'destroy',
                value: function destroy() {
                    this.removeListeners();
                    return this;
                }
            }, {
                key: 'removeListeners',
                value: function removeListeners() {
                    //unbind all pushstate links
                    (0, _gator2.default)(document).off('click', '[data-pushstate]');
                    //bind window popstates
                    window.removeEventListener('popstate', this.eventPopState.bind(this));
                    return this;
                }
            }]);

            return _class;
        }();
    })();
});
