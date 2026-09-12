'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Router = require('../dist');

function withoutBrowserGlobals(t) {
    const previousWindow = global.window;
    const previousDocument = global.document;
    delete global.window;
    delete global.document;
    t.after(() => {
        if (previousWindow === undefined) {delete global.window;} else {global.window = previousWindow;}
        if (previousDocument === undefined) {delete global.document;} else {global.document = previousDocument;}
    });
}

test('server runtime dispatches the same route contract without DOM globals', t => {
    withoutBrowserGlobals(t);
    const router = new Router();
    const calls = [];
    router.routes = {
        '/products': {
            title: 'Products',
            secure: (_scope, location) => location.data.query.allow === 'yes',
            view: {
                initialize: (_scope, location) => calls.push(['init', location]),
                destroy: (_scope, location) => calls.push(['destroy', location])
            }
        },
        '/about': (_scope, location) => calls.push(['about', location]),
        defaultRoute: (_scope, location) => calls.push(['default', location])
    };

    assert.equal(router.initialize('/products/42?allow=yes&color=blue#details'), router);
    assert.equal(router.route, '/products');
    assert.equal(router.pageTitle, 'Products');
    assert.deepEqual(router.locationData.data.url, ['42']);
    assert.deepEqual(router.locationData.data.query, {allow: 'yes', color: 'blue'});
    assert.equal(router.locationData.url, '/products/42?allow=yes&color=blue#details');

    assert.equal(router.navigate('/products/99?allow=no'), false);
    assert.equal(calls.length, 1);

    assert.equal(router.navigate('/about?x=1&x=2'), router);
    assert.deepEqual(calls[1][0], 'destroy');
    assert.deepEqual(calls[2][0], 'about');
    assert.deepEqual(router.locationData.data.query, {x: '2'});
    assert.equal(router.pageTitle, null);

    assert.equal(router.navigate('/missing/%E0%A4%A'), router);
    assert.deepEqual(router.locationData.data.url, ['missing', '%E0%A4%A']);
    assert.equal(calls.at(-1)[0], 'default');
});

test('server runtime keeps listener lifecycle and browser-only handlers safe', t => {
    withoutBrowserGlobals(t);
    const events = [];
    const router = new Router();
    router.mediator = {
        on(event, callback) {events.push(['on', event]); this.callback = callback;},
        removeListener(event, callback) {events.push(['off', event, callback === this.callback]);}
    };

    assert.equal(router.addListeners(), router);
    assert.equal(router.addListeners(), router);
    assert.deepEqual(events, [['on', 'router:navigate']]);
    assert.equal(router.eventPushStateClick({}), true);
    assert.equal(router.eventPopState({state: null}), router);
    assert.equal(router.removeListeners(), router);
    assert.equal(router.removeListeners(), router);
    assert.deepEqual(events[1], ['off', 'router:navigate', true]);
});

test('server initialize defaults to root and navigate does not require history', t => {
    withoutBrowserGlobals(t);
    const router = new Router();
    let location;
    router.routes = {defaultRoute: (_scope, value) => {location = value;}};
    assert.equal(router.initialize(), router);
    assert.equal(router.url, '/');
    assert.equal(location.url, '/');

    const second = new Router();
    second.routes = {'/health': () => true};
    assert.equal(second.navigate('/health'), second);
    assert.equal(second.route, '/health');
});
