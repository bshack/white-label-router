# white-label-router

A simple ES6 JS router based on the history api and pushstate.

Learn more about ES6 classes here:

https://babeljs.io/docs/learn-es2015/

## Install

Install the node module:

```
npm install white-label-router --save
```

## Import

```
import Router from 'white-label-router';
```


## Defining Routes

The most simple way simply executes any function you define:

```
const MyRoute = class extends Router {
    constructor() {
        super();
        this.routes = {
            defaultRoute: (locationData) => {
                //here you would put any view specific logic for the defaultRoute
                window.console.log('the defaultRoute executed');
            },
            '/page2': (locationData) => {
                //here you would put any view specific logic for the page2 route
                window.console.log('the page2 route executed');
            }
        };
    }
};
```

or you can also define initialize and destroy functions in your view which will be automatically called as the user navigates your application:

```
const MyRoute = class extends Router {
    constructor() {
        super();
        this.routes = {
            defaultRoute: {
                view: {
                    initialize: (locationData) => {
                        window.console.log('the defaultRoute initialized');
                    },
                    destroy: (locationData) => {
                        window.console.log('the defaultRoute has been destroyed');
                    }
                }
            },
            '/page2': {
                view: {
                    initialize: (locationData) => {
                        window.console.log('the page2 initialized');
                    },
                    destroy: (locationData) => {
                        window.console.log('the page2 has been destroyed');
                    }
                }
            }
        };
    }
};
```

You have some additional options when using the view object approach. They include the ability to set the page title for a route and also do security check before a route's view is initialized at the router level:

```
const MyRoute = class extends Router {
    constructor() {
        super();
        this.routes = {
            defaultRoute: {
                title: 'Home',
                view: {
                    initialize: (locationData) => {
                        window.console.log('the defaultRoute initialized');
                    },
                    destroy: (locationData) => {
                        window.console.log('the defaultRoute has been destroyed');
                    }
                }
            },
            '/page2': {
                title: 'Page 2',
                view: {
                    initialize: (locationData) => {
                        window.console.log('the page2 initialized');
                    },
                    destroy: (locationData) => {
                        window.console.log('the page2 has been destroyed');
                    }
                },
                secure: this.isSecure
            }
        };
    }
    isSecure (locationData) => {
        if (someCookieIsValid) {
            return true;
        } else {
            return false;
        }
    }
};
```

When a route is executed location data is passed if you need do additional logic around the url. It will include the full url and an array of data created from the path name.

NOTE: routes are matched by checking if the path name string starts with the route. For the example above the route '/page2' would be executed for both path names '/page2' and '/page23/232'.

## Instantiate

```
const myRouter = new MyRouter();

myRouter.initialize();
```

## HTML Linking To Routes

you can make any anchor tigger a specified route by simply setting the href attribute to your route path and adding the attribute 'data-pushstate'.

```
<a href="/page2" data-pushstate>take me to page2</a>
```

## Navigate

you can also trigger navigation to a route with the navigate method

```
myRouter.navigate('/page2');
```

## Mediator

Optionally you can use a mediator, such as White Label Mediator, with the router. To do so you would like this:

```
const MyRoute = class extends Router {
    constructor() {
        super();

        this.mediator = myMediator;

        this.routes = {
            defaultRoute: (locationData) => {
                //here you would put any view specific logic for the defaultRoute
                window.console.log('the defaultRoute executed');
            },
            '/page2': (locationData) => {
                //here you would put any view specific logic for the page2 route
                window.console.log('the page2 route executed');
            }
        };

    }
};
```

Then anywhere else in the application you want to trigger the router to navigate you could do so like this:

```
myMediator.emit('router:navigate', {
    url: '/authentication',
    message: 'Session expired, please login again.'
});
```

## Passing Data

The router passes in a location data object to the route that is being executed. Here is an example object passed:

```
{
    url: ['/user'],
    data: {
        url: [],
        mediator: {},
        query: {}
    }
}
```

'data.url' is an array of values parsed from the url being requested. For Example if the url was '/user/fred' and we defined a route for '/user' then data object passed into the '/user' route would be the following:

```
{
    url: ['/user/fred'],
    data: {
        url: ['fred'],
        mediator: {},
        query: {}
    }
}
```

'data.query' is an object of values parsed from the url query string. For Example if the url was '/user?name=fred' and we defined a route for '/user' then data object passed into the '/user' route would be the following:

```
{
    url: ['/user?name=fred'],
    data: {
        url: [],
        mediator: {},
        query: {
            name: 'fred'
        }
    }
}
```

'data.mediator' is an object of values parsed through the optional mediator. For Example if this was emitted through the mediator:

```
myMediator.emit('router:navigate', {
    url: '/authentication',
    message: 'Session expired, please login again.'
});
```

Then the location data passed in to the '/authentication' route would be the following:

```
{
    url: ['/authentication'],
    data: {
        url: [],
        mediator: {
            url: '/authentication',
            message: 'Session expired, please login again.'
        }
    }
}
```

## Let's look at an example:

import the module

```
import Router from 'white-label-router';
```

extend the router

```
const myRouter = class extends Router {
    // this is the constructor. This executed whenever the view is instantiated.
    constructor() {
        // always do this
        super();
        this.routes = {
            defaultRoute: (locationData) => {
                //here you would put any view specific logic for the defaultRoute
                window.console.log('the defaultRoute executed');
            },
            '/page2': (locationData) => {
                //here you would put any view specific logic for the page2 route
                window.console.log('the page2 route executed');
            }
        };
    }
};

```

instantiate your router

```
const myRouter = new MyRoute();
```

initialize your router

```
myRouter.initialize();
```

navigate to '/page2'

```
myRouter.navigate('/page2');
```

In the example above we have set up two routes. The first route 'defaultRoute' is a catch all route. If no other routes match the specified url path this is the route that will be executed. In this example the defaultRoute would be executed for 'http://example.com' or 'http://example.com/home', but not 'http://example.com/page2'.

The second defined route 'page2' will only be executed when the specified url path starts with '/page2', or for example 'http://example.com/page2'.
