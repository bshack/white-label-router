
// event delegation lib
import Gator from 'gator';

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
            }

            // this will hold the current url
            this.url = '';

            // this holds the current route displayed, used for destroying it later
            this.route = null;

            this.previousRoute = null;

            // this will hold the page title (not yet supported by browsers)
            this.pageTitle = null;

            // optional mediator placeholder
            this.mediator = false;

        }

        initialize() {

            //get the url fragment w/query string
            this.url = (window.location.pathname + (window.location.search || '') || '');

            // set up the events
            this.addListeners();

            // navigate to correct view
            this.navigate(false, {}, false);

            return this;

        }

        addListeners() {

            //bind all pushstate links
            Gator(document).on('click','a[href][data-pushstate]', this.eventPushStateClick.bind(this));

            //bind window popstates
            window.addEventListener('popstate', this.eventPopState.bind(this));

            //listen to a mediator if present
            if (this.mediator) {

                this.mediator.on('router:navigate', (data) => {
                    this.navigate(data.url, (data || {}), false);
                });

            }

            return this;

        }

        destroy() {

            this.removeListeners();

            return this;

        }

        removeListeners() {

            //unbind all pushstate links
            Gator(document).off('click', 'a[href][data-pushstate]');

            //bind window popstates
            window.removeEventListener('popstate', this.eventPopState.bind(this));

            return this;

        }

        eventPushStateClick(e) {

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

        eventPopState(e) {

            this.url = (e.state || '');

            this.navigate(false, {}, true);

            return this;

        }

        parseQueryString(queryString) {

            let params = {};
            let queries;
            let temp;
            let i;
            let l;

            // Split into key/value pairs
            queries = queryString.split('&amp;');

            // Convert the array of strings into an object
            for (i = 0, l = queries.length; i < l; i++) {
                temp = queries[i].split('=');
                params[temp[0]] = temp[1];
            }

            return params;

        }

        setLocationData(mediatorData) {

            //split the url here to seperate query strings from url path
            let urlFragments = this.url.split('?');

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
            if (this.locationData.data.url.length
                    && this.locationData.data.url[this.locationData.data.url.length - 1] === '') {
                this.locationData.data.url.splice(this.locationData.data.url.length - 1, 1);
            }

            //add query string data
            if (urlFragments[1]) {
                this.locationData.data.query = this.parseQueryString(urlFragments[1].replace('?', ''));
            }

        }

        navigate(url, mediatorData, isPopState) {

            //cache the old route
            this.previousRoute = this.route;

            // allow navigate to use a specified url
            if (url) {
                this.url = url;
            }

            // reset this to null for new location
            this.route = null;

            //find the first matcher that starts with the same string as a defined route
            for (let route in this.routes) {

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
                if (
                    typeof this.routes[this.route].secure === 'function' &&
                    this.routes[this.route].secure(this.locationData) !== true
                ) {
                    return false;
                }

                //if previous route then destroy it
                if (this.previousRoute) {

                    // else if it is an object check if there is a view class
                    if (
                        typeof this.routes[this.previousRoute] === 'object' &&
                        typeof this.routes[this.previousRoute].view === 'object' &&
                        typeof this.routes[this.previousRoute].view.destroy === 'function'
                    ) {

                        //destroy the view
                        this.routes[this.previousRoute].view.destroy(this.locationData);

                    }

                }

                //execute the route if it is a simple function
                if (typeof this.routes[this.route] === 'function') {

                    //execute the view
                    this.routes[this.route](this.locationData);

                } else if (
                    typeof this.routes[this.route] === 'object' &&
                    typeof this.routes[this.route].view === 'function'
                ) {

                    //execute the view
                    this.routes[this.route].view(this.locationData);

                    // if a title is defined for this route we'll set it
                    if (typeof this.routes[this.route].title === 'string') {
                        this.pageTitle = this.routes[this.route].title;
                    } else {
                        this.pageTitle = null;
                    }

                // else if it is an object check if there is a view class
                } else if (
                    typeof this.routes[this.route] === 'object' &&
                    typeof this.routes[this.route].view === 'object' &&
                    typeof this.routes[this.route].view.initialize === 'function'
                ) {

                    // if a title is defined for this route we'll set it
                    if (typeof this.routes[this.route].title === 'string') {
                        this.pageTitle = this.routes[this.route].title;
                    } else {
                        this.pageTitle = null;
                    }

                    //execute the view
                    this.routes[this.route].view.initialize(this.locationData);

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
