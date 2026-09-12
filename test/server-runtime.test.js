'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const Router = require('../dist');

test('routes requests without browser globals using the same Router API', () => {
    assert.equal(typeof globalThis.window, 'undefined');
    assert.equal(typeof globalThis.document, 'undefined');

    const calls = [];
    const router = new Router();
    router.routes = {
        '/products': {
            title: 'Products',
            secure: (scope, location) => {
                calls.push(['secure', scope, location.url]);
                return true;
            },
            view: (scope, location) => calls.push(['view', scope, location])
        },
        defaultRoute: (scope, location) => calls.push(['default', scope, location])
    };

    assert.equal(router.initialize('https://example.test/products/a%20b?tag=one&tag=two#details'), router);
    assert.equal(router.route, '/products');
    assert.equal(router.pageTitle, 'Products');
    assert.equal(router.url, '/products/a%20b?tag=one&tag=two#details');
    assert.deepEqual(router.locationData.data.url, ['a b']);
    assert.deepEqual(router.locationData.data.query, {tag: 'two'});
    assert.equal(calls[0][0], 'secure');
    assert.equal(calls[1][0], 'view');
    assert.equal(calls[1][1], null);

    assert.equal(router.navigate('/missing?q=%E2%9C%93', {requestId: 'abc'}, false), router);
    assert.equal(router.route, 'defaultRoute');
    assert.deepEqual(router.locationData.data.url, ['missing']);
    assert.deepEqual(router.locationData.data.query, {q: '✓'});
    assert.deepEqual(router.locationData.data.mediator, {requestId: 'abc'});
    assert.equal(router.eventPushStateClick({}), true);
    assert.equal(router.eventPopState({}), router);
    assert.equal(router.destroy(), router);
    assert.equal(router.listenersInitialized, false);
});

test('fresh server navigation without a URL safely resolves to root', () => {
    const router = new Router();
    assert.equal(router.url, '');
    assert.equal(router.navigate(), router);
    assert.equal(router.url, '/');
    assert.equal(router.route, 'defaultRoute');
});

test('server guards block a route without running its view or browser history', () => {
    let rendered = false;
    const router = new Router();
    router.routes = {
        '/private': {
            secure: () => false,
            view: () => { rendered = true; }
        }
    };

    assert.equal(router.initialize('/'), router);
    assert.equal(router.navigate('/private', undefined, false), false);
    assert.equal(rendered, false);
    assert.equal(router.previousRoute, null);
});

test('server lifecycle destroys the previous view and tolerates malformed path encoding', () => {
    const calls = [];
    const router = new Router();
    router.routes = {
        '/one': {
            view: {
                initialize: (_scope, location) => calls.push(['one:init', location.url]),
                destroy: (_scope, location) => calls.push(['one:destroy', location.url])
            }
        },
        '/two': {
            view: {
                initialize: (_scope, location) => calls.push(['two:init', location.data.url[0]])
            }
        }
    };

    router.initialize('/one');
    router.navigate('/two/%E0%A4%A', undefined, true);

    assert.deepEqual(calls, [
        ['one:init', '/one'],
        ['one:destroy', '/two/%E0%A4%A'],
        ['two:init', '%E0%A4%A']
    ]);
});

test('server initialize defaults to root and mediator listeners remain symmetrical', () => {
    const events = [];
    const mediator = {
        on: (name, callback) => events.push(['on', name, callback]),
        removeListener: (name, callback) => events.push(['off', name, callback])
    };
    const router = new Router();
    router.mediator = mediator;

    router.initialize();
    assert.equal(router.url, '/');
    assert.equal(events[0][0], 'on');
    assert.equal(router.addListeners(), router);
    assert.equal(events.length, 1);
    router.destroy();
    assert.equal(events[1][0], 'off');
    assert.equal(events[0][2], events[1][2]);
});

test('server initialization preserves a preconfigured URL when no request URL is passed', () => {
    const router = new Router();
    router.url = '/preconfigured';
    router.routes = {'/preconfigured': () => true};
    assert.equal(router.initialize(), router);
    assert.equal(router.url, '/preconfigured');
});
