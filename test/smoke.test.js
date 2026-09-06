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
    const anchor = {getAttribute: () => '/products'};
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
});
