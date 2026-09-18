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
    router.boundMediatorNavigate(new CustomEvent('router:navigate', {detail: null}));
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
    assert.equal(router.navigate('/unknown'), false);
    assert.equal(router.route, '/object');
    assert.equal(router.url, '/object');
    router.navigate('/object/%E0%A4%A');
    assert.deepEqual(router.locationData.data.url, ['%E0%A4%A']);
    router.previousRoute = '/empty';
    router.navigate('/object');
});
test('route-table replacement does not orphan the lifecycle that is already active', t => {
    browser(t);
    const router = new Router();
    const calls = [];
    const activeView = {
        initialize: () => calls.push('old:init'),
        destroy: () => calls.push('old:destroy')
    };

    router.routes = {
        '/page': {view: activeView},
        '/next': () => calls.push('next')
    };
    router.navigate('/page');

    router.routes = {
        '/page': {
            view: {
                initialize: () => calls.push('new:init'),
                destroy: () => calls.push('new:destroy')
            }
        },
        '/next': () => calls.push('next')
    };
    router.navigate('/next');

    assert.deepEqual(calls, ['old:init', 'old:destroy', 'next']);
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
    assert.equal(router.navigate('/inherited'), false);
    assert.equal(router.route, '/products/special');
    assert.deepEqual(inheritedCalls, []);

    router.routes = Object.create({defaultRoute: () => inheritedCalls.push('default')});
    assert.equal(router.navigate('/missing'), false);
    assert.equal(router.route, '/products/special');
    assert.deepEqual(inheritedCalls, []);
});
test('browser navigation uses one same-origin URL interpretation for matching, location data, and history', t => {
    const history = browser(t);
    const router = new Router();
    let sensitiveCalls = 0;
    router.routes = {'/page': () => true, '/sensitive': () => sensitiveCalls++};
    assert.equal(router.normalizeBrowserUrl(''), '/');
    window.location.href = '';
    assert.equal(router.normalizeBrowserUrl('/page'), '/page');
    window.location.href = 'https://example.test/';
    assert.equal(router.navigate('https://example.test/page?q=1#details'), router);
    assert.equal(router.url, '/page?q=1#details');
    assert.deepEqual(history.at(-1), ['/page?q=1#details', '', 'https://example.test/page?q=1#details']);
    const previousHistoryLength = history.length;
    assert.equal(router.navigate('https://outside.test/page'), false);
    assert.equal(history.length, previousHistoryLength);
    assert.equal(router.url, '/page?q=1#details');
    assert.equal(router.route, '/page');

    assert.equal(router.navigate('https://example.test//outside.test/sensitive'), false);
    assert.equal(router.url, '/page?q=1#details');
    assert.equal(router.route, '/page');
    assert.equal(sensitiveCalls, 0);
    assert.equal(history.length, previousHistoryLength);

    assert.equal(router.normalizeBrowserUrl('http://['), null);
});
test('invalid navigation input and mediator payloads reject without changing Router state', () => {
    const router = new Router();
    router.routes = {'/allowed': () => true};
    router.navigate('/allowed', {source: 'allowed'});
    const previousLocationData = router.locationData;

    for (const invalidUrl of ['http://[', 'https://example.test:99999']) {
        assert.equal(router.navigate(invalidUrl), false);
        assert.equal(router.url, '/allowed');
        assert.equal(router.route, '/allowed');
        assert.equal(router.locationData, previousLocationData);
    }
    assert.equal(router.navigate('/unmatched'), false);
    assert.equal(router.url, '/allowed');
    assert.equal(router.route, '/allowed');
    assert.equal(router.locationData, previousLocationData);
    assert.equal(router.navigate(42), false);
    assert.equal(router.normalizeBrowserUrl('/server'), '/server');

    router.url = 'http://[';
    router.setLocationData();
    assert.equal(router.locationData, previousLocationData);
    router.url = '/allowed';

    const mediator = new EventTarget();
    router.mediator = mediator;
    router.addListeners();
    assert.doesNotThrow(() => mediator.dispatchEvent(new CustomEvent('router:navigate', {detail: {url: 'http://['}})));
    mediator.dispatchEvent(new CustomEvent('router:navigate', {detail: {url: 42}}));
    mediator.dispatchEvent(new CustomEvent('router:navigate', {detail: []}));
    mediator.dispatchEvent(new CustomEvent('router:navigate', {detail: 'invalid'}));
    assert.equal(router.url, '/allowed');
    assert.equal(router.route, '/allowed');
    assert.equal(router.locationData, previousLocationData);
    router.destroy();
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
test('rejected popstate keeps the last successful Router URL and route', t => {
    browser(t);
    const router = new Router();
    router.routes = {
        '/allowed': () => true,
        '/blocked': {secure: () => false, view: () => true}
    };
    router.navigate('/allowed');
    const previousLocationData = router.locationData;
    window.location.pathname = '/blocked';
    assert.equal(router.eventPopState(), router);
    assert.equal(router.url, '/allowed');
    assert.equal(router.route, '/allowed');
    assert.equal(router.locationData, previousLocationData);
    assert.equal(window.location.pathname, '/blocked');
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
test('click handling preserves browser actions, document base URLs, and text-node targets', t => {
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

    document.baseURI = 'https://outside.test/';
    let prevented = false;
    const basedAnchor = {href: 'https://outside.test/sensitive', getAttribute: name => name === 'href' ? '/sensitive' : null, hasAttribute: () => false};
    router.eventPushStateClick(event({target: {closest: () => basedAnchor}, preventDefault() {prevented = true;}}));
    assert.equal(prevented, false);
    assert.equal(navigations, 2);

    const malformedAnchor = {href: 'http://[', getAttribute: name => name === 'href' ? 'http://[' : null, hasAttribute: () => false};
    assert.doesNotThrow(() => router.eventPushStateClick(event({target: {closest: () => malformedAnchor}})));
    assert.equal(navigations, 2);

    document.baseURI = 'https://example.test/';
    const nativeRouter = new Router();
    nativeRouter.routes = {'/handled': () => true};
    let unmatchedPrevented = false;
    const unmatched = anchor({href: '/unmatched'});
    assert.equal(nativeRouter.eventPushStateClick(event({
        target: {closest: () => unmatched},
        preventDefault() {unmatchedPrevented = true;}
    })), true);
    assert.equal(unmatchedPrevented, false);

    let handledPrevented = false;
    const handled = anchor({href: '/handled'});
    nativeRouter.eventPushStateClick(event({
        target: {closest: () => handled},
        preventDefault() {handledPrevented = true;}
    }));
    assert.equal(handledPrevented, true);
    assert.equal(nativeRouter.route, '/handled');
});
