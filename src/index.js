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
            //bind all pushstate links
            Gator(document).on(
                'click',
                '[data-pushstate]',
                this.eventPushStateClick.bind(this)
            );
            //bind window popstates
            window
                .addEventListener(
                    'popstate',
                    this.eventPopState.bind(this)
                );
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

            // default to false, status of if we have an route matching the url
            let matcher = false;

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
            for (let route in this.routes) {
                if (this.url.lastIndexOf(route, 0) === 0) {
                    // parse out the url data
                    this.locationData.data = this.url.replace(route, '').split('/');
                    this.locationData.data.splice(0, 1);
                    // remove any trailing empty items from the array
                    if (this.locationData.data.length
                            && this.locationData.data[this.locationData.data.length - 1] === '') {
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
        destroy() {
            this.removeListeners();
            return this;
        }
        removeListeners() {
            //unbind all pushstate links
            Gator(document).off(
                'click',
                '[data-pushstate]'
            );
            //bind window popstates
            window
                .removeEventListener(
                    'popstate',
                    this.eventPopState.bind(this)
                );
            return this;
        }
    };
})();
