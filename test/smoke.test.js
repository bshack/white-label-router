'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const EventEmitter = require('node:events');

test('exports the Router constructor', function() {
    const Router = require('../dist/index');

    assert.equal(typeof Router, 'function');
});

test('listener cleanup uses the exact functions registered during initialization', function() {
    const Router = require('../dist/index');
    const added = {};
    const removed = {};
    global.document = {
        addEventListener(type, listener) {
            added.document = {type, listener};
        },
        removeEventListener(type, listener) {
            removed.document = {type, listener};
        }
    };
    global.window = {
        addEventListener(type, listener) {
            added.window = {type, listener};
        },
        removeEventListener(type, listener) {
            removed.window = {type, listener};
        }
    };
    const router = new Router();

    router.addListeners();
    router.addListeners();
    router.removeListeners();

    assert.equal(removed.document.listener, added.document.listener);
    assert.equal(removed.window.listener, added.window.listener);
    delete global.document;
    delete global.window;
});

test('destroy removes the mediator listener and repeated initialization does not duplicate it', function() {
    const Router = require('../dist/index');
    const mediator = new EventEmitter();
    global.document = {
        addEventListener() {},
        removeEventListener() {}
    };
    global.window = {
        addEventListener() {},
        removeEventListener() {}
    };
    const router = new Router();
    router.mediator = mediator;

    router.addListeners();
    router.addListeners();
    assert.equal(mediator.listenerCount('router:navigate'), 1);

    router.destroy();
    assert.equal(mediator.listenerCount('router:navigate'), 0);
    delete global.document;
    delete global.window;
});

test('delegated navigation resolves a nested target to its push-state anchor', function() {
    const Router = require('../dist/index');
    const router = new Router();
    global.window = {location: {href: 'https://example.test/', origin: 'https://example.test'}};
    const anchor = {
        getAttribute(name) {
            return name === 'href' ? '/products' : null;
        },
        hasAttribute: () => false
    };
    let prevented = false;
    let navigated = false;
    router.navigate = function() {
        navigated = true;
    };

    router.eventPushStateClick({
        preventDefault() {
            prevented = true;
        },
        target: {closest: () => anchor}
    });

    assert.equal(router.url, '/products');
    assert.equal(prevented, true);
    assert.equal(navigated, true);
    delete global.window;
});

test('delegated navigation leaves modified and external links to the browser', function() {
    const Router = require('../dist/index');
    global.window = {location: {href: 'https://example.test/', origin: 'https://example.test'}};
    const router = new Router();
    const anchor = {
        getAttribute(name) {
            return name === 'href' ? 'https://other.test/products' : null;
        },
        hasAttribute: () => false
    };
    let prevented = false;

    router.eventPushStateClick({
        ctrlKey: true,
        preventDefault() {
            prevented = true;
        },
        target: {closest: () => anchor}
    });
    assert.equal(prevented, false);

    router.eventPushStateClick({
        preventDefault() {
            prevented = true;
        },
        target: {closest: () => anchor}
    });
    assert.equal(prevented, false);
    delete global.window;
});

test('route matching respects path boundaries and decodes location data', function() {
    const Router = require('../dist/index');
    global.document = {title: ''};
    global.window = {
        history: {pushState() {}},
        location: {origin: 'https://example.test'}
    };
    const router = new Router();
    let matched = '';
    router.routes = {
        '/page2': (scope, location) => {
            matched = `page2:${location.data.url[0]}:${location.data.query.name}`;
        },
        defaultRoute: () => {
            matched = 'default';
        }
    };

    router.navigate('/page23');
    assert.equal(matched, 'default');

    router.navigate('/page2/fred%20smith?name=Grace+Hopper');
    assert.equal(matched, 'page2:fred smith:Grace Hopper');
    delete global.document;
    delete global.window;
});
