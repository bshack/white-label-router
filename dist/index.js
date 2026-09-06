(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof exports !== "undefined") {
    factory();
  } else {
    var mod = {
      exports: {}
    };
    factory();
    global.index = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function () {
  "use strict";

  (() => {
    'use strict';

    module.exports = class {
      constructor() {
        // placeholder for routes defined when extended
        this.routes = {
          defaultRoute: {
            view: {
              initialize: () => {
                return true;
              },
              destroy: () => {
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

        // Stable listener references allow destroy() to release browser resources.
        this.boundPushStateClick = this.eventPushStateClick.bind(this);
        this.boundPopState = this.eventPopState.bind(this);
        this.boundMediatorNavigate = (data = {}) => {
          this.navigate(data.url, data, false);
        };
        this.listenersInitialized = false;
      }
      initialize() {
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
      addListeners() {
        if (this.listenersInitialized) {
          return this;
        }

        // Delegate push-state links from one document listener.
        document.addEventListener('click', this.boundPushStateClick);

        //bind window popstates
        window.addEventListener('popstate', this.boundPopState);

        //listen to a mediator if present
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
      removeListeners() {
        if (!this.listenersInitialized) {
          return this;
        }

        // Unbind the same stable listener objects registered by addListeners().
        document.removeEventListener('click', this.boundPushStateClick);

        //bind window popstates
        window.removeEventListener('popstate', this.boundPopState);
        if (this.mediator && typeof this.mediator.removeListener === 'function') {
          this.mediator.removeListener('router:navigate', this.boundMediatorNavigate);
        }
        this.listenersInitialized = false;
        return this;
      }
      eventPushStateClick(e) {
        if (e.defaultPrevented || e.button !== undefined && e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
          return true;
        }
        const source = e.target && (typeof e.target.closest === 'function' ? e.target : e.target.parentElement);
        const anchor = source && typeof source.closest === 'function' ? source.closest('a[href][data-pushstate]') : null;
        if (!anchor) {
          return true;
        }
        const target = anchor.getAttribute('target');
        if (anchor.hasAttribute('download') || target && target.toLowerCase() !== '_self') {
          return true;
        }
        const location = new URL(anchor.getAttribute('href'), window.location.href || `${window.location.origin}/`);
        if (location.origin !== window.location.origin) {
          return true;
        }
        e.preventDefault();

        // closest() supports nested elements at any depth inside the selected anchor.
        this.url = `${location.pathname}${location.search}${location.hash}`;
        this.navigate(false, {}, false);
        return this;
      }
      eventPopState(e) {
        this.url = e.state || '';
        this.navigate(false, {}, true);
        return this;
      }
      parseQueryString(queryString) {
        return Object.fromEntries(new URLSearchParams(queryString));
      }
      setLocationData(mediatorData) {
        const parsedUrl = new URL(this.url, window.location.origin);
        const matchedRoute = this.route && this.route !== 'defaultRoute' ? this.route : '';

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
        this.locationData.data.url = parsedUrl.pathname.slice(matchedRoute.length).split('/').filter(Boolean).map(fragment => {
          try {
            return decodeURIComponent(fragment);
          } catch (error) {
            return fragment;
          }
        });

        //add query string data
        this.locationData.data.query = this.parseQueryString(parsedUrl.search);
      }
      navigate(url, mediatorData, isPopState) {
        // allow navigate to use a specified url
        if (url) {
          this.url = url;
        }

        //clean up url for matching
        this.url = this.url.replace(window.location.origin, '');

        // reset this to null for new location
        this.route = null;
        const pathname = new URL(this.url, window.location.origin).pathname;

        // Match complete path segments so /page2 does not also match /page23.
        for (let route in this.routes) {
          if (route !== 'defaultRoute' && (pathname === route || pathname.startsWith(`${route}/`))) {
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
            if (typeof this.routes[this.previousRoute] === 'object' && typeof this.routes[this.previousRoute].view === 'object' && typeof this.routes[this.previousRoute].view.destroy === 'function') {
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
          } else if (typeof this.routes[this.route] === 'object' && typeof this.routes[this.route].view === 'function') {
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
          } else if (typeof this.routes[this.route] === 'object' && typeof this.routes[this.route].view === 'object' && typeof this.routes[this.route].view.initialize === 'function') {
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
    };
  })();
});
