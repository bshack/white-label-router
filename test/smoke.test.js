'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

test('exports the Router constructor', function() {
    const Router = require('../dist/index');
    const router = new Router();
    assert.equal(typeof Router, 'function');
    assert.equal(router.constructor, Router);
});

test('listener cleanup uses the exact functions registered during initialization', function() {
    const Router = require('../dist/index');
    const router = new Router();
    const added = new Map();
    const removed = new Map();
    global.document = {
        addEventListener(type, handler) {added.set(type, handler);},
        removeEventListener(type, handler) {removed.set(type, handler);}
    };
    global.window = {
        location: {origin: 'https://example.test', pathname: '/', search: '', hash: ''},
        addEventListener(type, handler) {added.set(type, handler);},
        removeEventListener(type, handler) {removed.set(type, handler);}
    };

    router.addListeners();
    router.removeListeners();

    assert.equal(removed.get('click'), added.get('click'));
    assert.equal(removed.get('popstate'), added.get('popstate'));
    delete global.document;
    delete global.window;
});

test('destroy removes the mediator listener and repeated initialization does not duplicate it', function() {
    const Router = require('../dist/index');
    const router = new Router();
    const mediator = new EventTarget();
    let navigations = 0;
    global.document = {
        addEventListener() {},
        removeEventListener() {}
    };
    global.window = {
        location: {href: 'https://example.test/', origin: 'https://example.test', pathname: '/', search: '', hash: ''},
        history: {pushState() {}},
        addEventListener() {},
        removeEventListener() {}
    };
    router.mediator = mediator;
    router.navigate = function() {
        navigations += 1;
        return this;
    };

    router.addListeners();
    router.addListeners();
    mediator.dispatchEvent(new CustomEvent('router:navigate', {detail: {url: '/account'}}));
    assert.equal(navigations, 1);

    router.destroy();
    mediator.dispatchEvent(new CustomEvent('router:navigate', {detail: {url: '/ignored'}}));
    assert.equal(navigations, 1);
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
    let navigatedUrl = null;
    router.navigate = function(url) {
        navigatedUrl = url;
        return this;
    };

    router.eventPushStateClick({
        preventDefault() {
            prevented = true;
        },
        target: {closest: () => anchor}
    });

    assert.equal(navigatedUrl, '/products');
    assert.equal(prevented, true);
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
    let navigated = false;
    router.navigate = function() {navigated = true;};

    assert.equal(router.eventPushStateClick({
        metaKey: true,
        preventDefault() {prevented = true;},
        target: {closest: () => anchor}
    }), true);
    assert.equal(router.eventPushStateClick({
        preventDefault() {prevented = true;},
        target: {closest: () => anchor}
    }), true);
    assert.equal(prevented, false);
    assert.equal(navigated, false);
    delete global.window;
});

test('route matching respects path boundaries and decodes location data', function() {
    const Router = require('../dist/index');
    const router = new Router();
    let received;
    router.routes = {
        '/products': (_scope, location) => {received = location;},
        defaultRoute: () => true
    };

    router.navigate('/products/a%20b?tag=one&tag=two');
    assert.deepEqual(received.data.url, ['a b']);
    assert.deepEqual(received.data.query, {tag: 'two'});

    received = undefined;
    router.navigate('/products-old');
    assert.equal(received, undefined);
    assert.equal(router.route, 'defaultRoute');
});
