# white-label-router

A simple ES6 JS router based on url hashes.

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
            defaultRoute: () => {
                //here you would put any view specific logic for the defaultRoute
                window.console.log('the defaultRoute executed');
            },
            page2: () => {
                //here you would put any view specific logic for the page2 route
                window.console.log('the page2 route executed');
            }
        };
    }
};
```

## Instantiate

```
const myRouter = new MyRouter();

myRouter.someGreatFeature();
```

## Adding routes complete example

import the module

```
import Router from 'white-label-router';
```

extend the router

```
const MyRoute = class extends Router {
    // this is the constructor. This executed whenever the view is instantiated.
    constructor() {
        // always do this
        super();
        this.routes = {
            defaultRoute: () => {
                //here you would put any view specific logic for the defaultRoute
                window.console.log('the defaultRoute executed');
            },
            page2: () => {
                //here you would put any view specific logic for the page2 route
                window.console.log('the page2 route executed');
            }
        };
    }
};

```

instantiate your router

```
const myRoute = new MyRoute();
```

initialize your router

```
myRoute.initialize();
```

In the example above we have set up two routes. The first route 'defaultRoute' is a catch all route. If no other routes match the current hash this is the route that will be executed. In this example the defaultRoute would execute for 'http://example.com' or 'http://example.com/#home' but not 'http://example.com/#page2'.

The second route 'page2' will only be executed when the hash matches exactly 'page2', or for example 'http://example.com/#page2'.
