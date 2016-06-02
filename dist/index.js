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

                this.routes = routes || {};
            }

            _createClass(_class, [{
                key: 'initialize',
                value: function initialize() {
                    this.addListeners();
                    this.checkRoute();
                    return this;
                }
            }, {
                key: 'addListeners',
                value: function addListeners() {
                    var _this = this;

                    window.addEventListener('hashchange', function (e) {
                        _this.checkRoute();
                    });
                    return this;
                }
            }, {
                key: 'checkRoute',
                value: function checkRoute(callback) {
                    var hashCleanedString = window.location.hash.substr(1);
                    if (this.routes[hashCleanedString]) {
                        this.routes[hashCleanedString]();
                    }
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
