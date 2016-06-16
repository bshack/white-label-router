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

## Extending

```
const MyRouter = class extends Router {
    someGreatFeature() {
        console.log('this is great!');
    }
};
```

## Defining Routes

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
