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

## Instantiate

```
var myRouter = new Router();
```

or extend the view class for your own needs:

```
const MyRouter = class extends Router {
    someGreatFeature() {
        console.log('this is great!');
    }
};

const myRouter = new MyRouter();

myRouter.someGreatFeature();
```

## Adding routes complete example

At instantiation you set the routes:

```
//demo.js

import Router from 'white-label-router';
import ViewDemoIndex from '../view/demo/index.js';
import ViewDemoPage2 from '../view/demo/page2.js';

const viewDemoIndex = new ViewDemoIndex();
const viewDemoPage2 = new ViewDemoPage2();

module.exports = class extends Router {
    // this is the constructor. This executed whenever the view is instantiated.
    constructor() {
        // always do this
        super();
        this.routes = {
            defaultRoute: () => {
                viewDemoPage2.destroy();
                viewDemoIndex.initialize();
            },
            page2: () => {
                viewDemoIndex.destroy();
                viewDemoPage2.initialize();
            }
        };
    }
};
```

In the example above we have set up two routes. The first route 'defaultRoute' is
a catch all route. If no other routes match the current hash this is the route that
will be executed. The second route 'page2' will be executed when the hash matches
exactly 'page2'.

Next you would just require it another script file and initialize it:

```
//index.js

import RouterDemo from './demo.js';

const routerDemo = new RouterDemo();

routerDemo.initialize();
```
