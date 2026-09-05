(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(["gator"], factory);
  } else if (typeof exports !== "undefined") {
    factory(require("gator"));
  } else {
    var mod = {
      exports: {}
    };
    factory(global.gator);
    global.index = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function (_gator) {
  "use strict";

  _gator = _interopRequireDefault(_gator);
  function _interopRequireDefault(e) { return e && e.__esModule ? e : { "default": e }; }
  function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
  function _classCallCheck(a, n) { if (!(a instanceof n)) throw new TypeError("Cannot call a class as a function"); }
  function _defineProperties(e, r) { for (var t = 0; t < r.length; t++) { var o = r[t]; o.enumerable = o.enumerable || !1, o.configurable = !0, "value" in o && (o.writable = !0), Object.defineProperty(e, _toPropertyKey(o.key), o); } }
  function _createClass(e, r, t) { return r && _defineProperties(e.prototype, r), t && _defineProperties(e, t), Object.defineProperty(e, "prototype", { writable: !1 }), e; }
  function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
  function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); } // event delegation lib
  (function () {
    'use strict';

    module.exports = /*#__PURE__*/function () {
      function _class() {
        _classCallCheck(this, _class);
        // placeholder for routes defined when extended
        this.routes = {
          defaultRoute: {
            view: {
              initialize: function initialize() {
                return true;
              },
              destroy: function destroy() {
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
      }
      return _createClass(_class, [{
        key: "initialize",
        value: function initialize() {
          // set orgin if not supported by the browser
          if (!window.location.origin) {
            window.location.origin = window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : '');
          }

          //get the url fragment w/query string
          this.url = window.location.pathname + (window.location.search || '') || '';

          // set up the events
          this.addListeners();

          // navigate to correct view
          this.navigate(false, {}, false);
          return this;
        }
      }, {
        key: "addListeners",
        value: function addListeners() {
          var _this = this;
          //bind all pushstate links
          (0, _gator["default"])(document).on('click', 'a[href][data-pushstate]', this.eventPushStateClick.bind(this));

          //bind window popstates
          window.addEventListener('popstate', this.eventPopState.bind(this));

          //listen to a mediator if present
          if (this.mediator) {
            this.mediator.on('router:navigate', function (data) {
              _this.navigate(data.url, data || {}, false);
            });
          }
          return this;
        }
      }, {
        key: "destroy",
        value: function destroy() {
          this.removeListeners();
          return this;
        }
      }, {
        key: "removeListeners",
        value: function removeListeners() {
          //unbind all pushstate links
          (0, _gator["default"])(document).off('click', 'a[href][data-pushstate]');

          //bind window popstates
          window.removeEventListener('popstate', this.eventPopState.bind(this));
          return this;
        }
      }, {
        key: "eventPushStateClick",
        value: function eventPushStateClick(e) {
          e.preventDefault();

          //for example an image tag can initiate a click event in side an anchor
          if (e.target.tagName === 'A') {
            this.url = e.target.getAttribute('href') || '';
          } else {
            this.url = e.target.parentNode.getAttribute('href') || '';
          }
          this.navigate(false, {}, false);
          return this;
        }
      }, {
        key: "eventPopState",
        value: function eventPopState(e) {
          this.url = e.state || '';
          this.navigate(false, {}, true);
          return this;
        }
      }, {
        key: "parseQueryString",
        value: function parseQueryString(queryString) {
          var params = {};
          var queries;
          var temp;
          var i;
          var l;

          // Split into key/value pairs
          queries = queryString.split('&amp;');

          // Convert the array of strings into an object
          for (i = 0, l = queries.length; i < l; i++) {
            temp = queries[i].split('=');
            params[temp[0]] = temp[1];
          }
          return params;
        }
      }, {
        key: "setLocationData",
        value: function setLocationData(mediatorData) {
          //split the url here to seperate query strings from url path
          var urlFragments = this.url.split('?');

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
          this.locationData.data.url = urlFragments[0].replace(this.route, '').split('/');
          this.locationData.data.url.splice(0, 1);

          // remove any trailing empty items from the array
          if (this.locationData.data.url.length && this.locationData.data.url[this.locationData.data.url.length - 1] === '') {
            this.locationData.data.url.splice(this.locationData.data.url.length - 1, 1);
          }

          //add query string data
          if (urlFragments[1]) {
            this.locationData.data.query = this.parseQueryString(urlFragments[1].replace('?', ''));
          }
        }
      }, {
        key: "navigate",
        value: function navigate(url, mediatorData, isPopState) {
          // allow navigate to use a specified url
          if (url) {
            this.url = url;
          }

          //clean up url for matching
          this.url = this.url.replace(window.location.origin, '');

          // reset this to null for new location
          this.route = null;

          //find the first matcher that starts with the same string as a defined route
          for (var route in this.routes) {
            // we have a match
            if (this.url.lastIndexOf(route, 0) === 0) {
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
            // check if the page is secure and if the user passes the specified secure checking function
            if (typeof this.routes[this.route].secure === 'function' && this.routes[this.route].secure(this.scope, this.locationData) !== true) {
              return false;
            }

            //if previous route then destroy it
            if (this.previousRoute) {
              // else if it is an object check if there is a view class
              if (_typeof(this.routes[this.previousRoute]) === 'object' && _typeof(this.routes[this.previousRoute].view) === 'object' && typeof this.routes[this.previousRoute].view.destroy === 'function') {
                //destroy the view
                this.routes[this.previousRoute].view.destroy(this.scope, this.locationData);
              }
            }

            //execute the route if it is a simple function
            if (typeof this.routes[this.route] === 'function') {
              //execute the view
              this.routes[this.route](this.scope, this.locationData);

              //cache the old route
              this.previousRoute = this.route;
            } else if (_typeof(this.routes[this.route]) === 'object' && typeof this.routes[this.route].view === 'function') {
              //execute the view
              this.routes[this.route].view(this.scope, this.locationData);

              // if a title is defined for this route we'll set it
              if (typeof this.routes[this.route].title === 'string') {
                this.pageTitle = this.routes[this.route].title;
              } else {
                this.pageTitle = null;
              }

              //cache the old route
              this.previousRoute = this.route;

              // else if it is an object check if there is a view class
            } else if (_typeof(this.routes[this.route]) === 'object' && _typeof(this.routes[this.route].view) === 'object' && typeof this.routes[this.route].view.initialize === 'function') {
              // if a title is defined for this route we'll set it
              if (typeof this.routes[this.route].title === 'string') {
                this.pageTitle = this.routes[this.route].title;
              } else {
                this.pageTitle = null;
              }

              //execute the view
              this.routes[this.route].view.initialize(this.scope, this.locationData);

              //cache the old route
              this.previousRoute = this.route;
            } else {
              return false;
            }
          }

          // make sure to not set pushstate on back button click
          if (!isPopState) {
            //set in history the new url
            window.history.pushState(this.url, this.pageTitle, this.url);
          }

          // since browsers don't support setting the title with pushstate yet
          if (this.pageTitle) {
            document.title = this.pageTitle;
          }
          return this;
        }
      }]);
    }();
  })();
});
