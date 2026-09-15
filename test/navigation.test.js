'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Router = require('../dist');
function browser(t) {
    const history = [];
    global.window = {location: {origin: 'https://example.test', href: 'https://example.test/', pathname: '/', search: ''}, history: {pushState(...args) {history.push(args);}}, addEventListener() {}, removeEventListener() {}};
    global.document = {title: '', addEventListener() {}, removeEventListener() {}, querySelector() {return null;}};
    t.after(() => {delete global.window; delete global.document;});
    return history;
}
test('default route initializes, reinitializes, and handles browser back without pushing history', t => {
    const history = browser(t);
    const router = new Router();
    router.removeListeners();
    assert.equal(router.initialize(), router);
    assert.equal(router.navigate('/next'), router);
    window.location.pathname = '/previous';
    assert.equal(router.eventPopState({state: '/ignored'}), router);
    assert.equal(router.url, '/previous');
    window.location.search = '?q=1';
    window.location.hash = '#section';
    router.eventPopState({state: null});
    assert.equal(router.url, '/previous?q=1#section');
    router.eventPopState({state: {unrelated: true}});
    assert.equal(router.url, '/previous?q=1#section');
    assert.equal(history.length, 1);
    router.destroy();
    router.mediator = {addEventListener() {}, removeEventListener() {}};
    router.addListeners(); router.removeListeners();
    router.boundMediatorNavigate(new Event('router:navigate'));
    router.boundMediatorNavigate(new CustomEvent('router:navigate', {detail: {url: '/mediator'}}));
    assert.equal(router.url, '/mediator');
});
test('route guards, titles, function handlers and lifecycle teardown retain ordering', t => {
    browser(t);
    const router = new Router();
    const calls = [];
    router.routes = {
        '/private': {secure: () => false, view: () => calls.push('forbidden')},
        '/page': {secure: () => true, title: 'Page', view: {initialize: () => calls.push('init'), destroy: () => calls.push('destroy')}},
        '/function': {title: 'Function', view: () => calls.push('function')},
        '/untitled': {view: () => calls.push('untitled')},
        '/object': {view: {initialize: () => calls.push('object')}},
        '/empty': {view: {}},
        '/missing': {}
    };
    assert.equal(router.navigate('/private'), false);
    router.navigate('/page');
    assert.equal(document.title, 'Page');
    router.navigate('/function');
    assert.deepEqual(calls, ['init', 'destroy', 'function']);
    assert.equal(document.title, 'Function');
    router.navigate('/untitled');
    assert.equal(router.pageTitle, null);
    router.navigate('/object');
    const beforeFailedNavigation = calls.slice();
    assert.equal(router.navigate('/empty'), false);
    assert.equal(router.navigate('/missing'), false);
    assert.deepEqual(calls, beforeFailedNavigation);
    assert.equal(router.previousRoute, '/object');
    assert.equal(router.route, '/object');
    assert.equal(router.url, '/object');
    assert.equal(router.navigate('/unknown'), router);
    router.navigate('/object/%E0%A4%A');
    assert.deepEqual(router.locationData.data.url, ['%E0%A4%A']);
    router.previousRoute = '/empty';
    router.navigate('/object');
});
test('most-specific matching is independent of route declaration order and inherited properties', () => {
    const router = new Router();
    const calls = [];
    router.routes = {
        '/products': (_scope, location) => calls.push(['products', location.data.url]),
        '/products/special': (_scope, location) => calls.push(['special', location.data.url]),
        defaultRoute: () => calls.push(['default'])
    };
    router.navigate('/products/special/42');
    assert.equal(router.route, '/products/special');
    assert.deepEqual(calls, [['special', ['42']]]);

    const inheritedCalls = [];
    router.routes = Object.assign(Object.create({'/inherited': () => inheritedCalls.push('inherited')}), {
        '/owned': () => inheritedCalls.push('owned')
    });
    router.navigate('/inherited');
    assert.equal(router.route, null);
    assert.deepEqual(inheritedCalls, []);
});
test('browser navigation normalizes same-origin absolute URLs and rejects cross-origin URLs without corrupting current state', t => {
    const history = browser(t);
    const router = new Router();
    router.routes = {'/page': () => true};
    assert.equal(router.normalizeBrowserUrl(''), '/');
    window.location.href = '';
    assert.equal(router.normalizeBrowserUrl('/page'), '/page');
    window.location.href = 'https://example.test/';
    assert.equal(router.navigate('https://example.test/page?q=1#details'), router);
    assert.equal(router.url, '/page?q=1#details');
    assert.deepEqual(history.at(-1), ['/page?q=1#details', '', '/page?q=1#details']);
    const previousHistoryLength = history.length;
    assert.equal(router.navigate('https://outside.test/page'), false);
    assert.equal(history.length, previousHistoryLength);
    assert.equal(router.url, '/page?q=1#details');
    assert.equal(router.route, '/page');
});
test('reassigning mediator moves the owned router:navigate subscription', () => {
    const router = new Router();
    const first = new EventTarget();
    const second = new EventTarget();
    router.routes = {'/first': () => true, '/second': () => true};
    assert.equal(router.mediator, false);
    router.mediator = first;
    router.mediator = first;
    assert.equal(router.mediator, first);
    router.addListeners();
    router.mediator = second;

    first.dispatchEvent(new CustomEvent('router:navigate', {detail: {url: '/first'}}));
    assert.equal(router.url, '');
    second.dispatchEvent(new CustomEvent('router:navigate', {detail: {url: '/second'}}));
    assert.equal(router.url, '/second');

    router.destroy();
    second.dispatchEvent(new CustomEvent('router:navigate', {detail: {url: '/first'}}));
    assert.equal(router.url, '/second');
});
test('rejected guards preserve the previously successful router state', () => {
    const router = new Router();
    router.routes = {
        '/allowed': () => true,
        '/blocked': {secure: () => false, view: () => true}
    };
    router.navigate('/allowed', {source: 'allowed'});
    const previousLocationData = router.locationData;
    assert.equal(router.navigate('/blocked', {source: 'blocked'}), false);
    assert.equal(router.url, '/allowed');
    assert.equal(router.route, '/allowed');
    assert.equal(router.locationData, previousLocationData);
    assert.equal(router.previousRoute, '/allowed');
});
test('page context updates title and focuses the configured target', t => {
    browser(t);
    const target = {focused: false, hasAttribute: () => false, setAttribute(name, value) {this[name] = value;}, focus() {this.focused = true;}};
    document.querySelector = selector => selector === '#title' ? target : null;
    const router = new Router();
    assert.equal(router.applyPageContext({title: 'Accessible page', focus: '#title', view() {}}), router);
    assert.equal(document.title, 'Accessible page');
    assert.equal(target.tabindex, '-1');
    assert.equal(target.focused, true);
    target.hasAttribute = () => true;
    router.applyPageContext({focus: '#title', view() {}});
    router.applyPageContext({focus: false, view() {}});
    router.applyPageContext(() => {});
    assert.equal(router.pageTitle, null);
});
test('click handling preserves browser actions and handles text-node targets', t => {
    browser(t);
    const router = new Router();
    let navigations = 0;
    router.navigate = url => {navigations++; router.url = url; return router;};
    const event = overrides => ({button: 0, preventDefault() {}, ...overrides});
    for (const overrides of [{defaultPrevented: true}, {button: 1}, {metaKey: true}, {shiftKey: true}, {altKey: true}, {target: null}, {target: {}}, {target: {closest: () => null}}]) {
        assert.equal(router.eventPushStateClick(event(overrides)), true);
    }
    const anchor = (attrs) => ({getAttribute: name => attrs[name], hasAttribute: name => name in attrs});
    for (const attrs of [{href: '/', download: ''}, {href: '/', target: '_blank'}]) {
        assert.equal(router.eventPushStateClick(event({target: {closest: () => anchor(attrs)}})), true);
    }
    assert.equal(navigations, 0);
    router.eventPushStateClick(event({target: {parentElement: {closest: () => anchor({href: '/nested', target: '_self'})}}}));
    assert.equal(router.url, '/nested');
    window.location.href = '';
    router.eventPushStateClick(event({target: {closest: () => anchor({})}}));
    assert.equal(router.url, '/');
    assert.equal(navigations, 2);
});