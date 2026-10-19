'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Router = require('../dist');

function browser(t, path = '/') {
    const history = [];
    const focused = [];
    global.window = {
        location: {origin: 'https://example.test', href: `https://example.test${path}`, pathname: path, search: '', hash: ''},
        history: {pushState(...args) {history.push(args);}},
        addEventListener() {},
        removeEventListener() {}
    };
    global.document = {
        title: '',
        baseURI: 'https://example.test/',
        addEventListener() {},
        removeEventListener() {},
        querySelector: selector => ({hasAttribute: () => true, focus() {focused.push(selector);}})
    };
    t.after(() => {delete global.window; delete global.document;});
    return {history, focused};
}

function click(href, overrides = {}) {
    const anchor = {getAttribute: name => name === 'href' ? href : null, hasAttribute: () => false};
    const event = {
        button: 0,
        prevented: false,
        target: {closest: selector => selector === 'a[href][data-pushstate]' ? anchor : null},
        preventDefault() {event.prevented = true;},
        ...overrides
    };
    return event;
}

test('a navigation started inside initialize() supersedes the outer navigation', t => {
    const {history, focused} = browser(t);
    const router = new Router();
    const calls = [];
    router.routes = {
        '/outer': {
            title: 'Outer',
            focus: '#outer',
            view: {
                initialize() {calls.push('outer:init'); router.navigate('/inner');},
                destroy: () => calls.push('outer:destroy')
            }
        },
        '/inner': {
            title: 'Inner',
            focus: '#inner',
            view: {initialize: () => calls.push('inner:init'), destroy: () => calls.push('inner:destroy')}
        },
        '/next': () => calls.push('next')
    };

    assert.equal(router.navigate('/outer'), router);
    assert.deepEqual(calls, ['outer:init', 'outer:destroy', 'inner:init']);
    assert.equal(router.url, '/inner');
    assert.equal(router.route, '/inner');
    assert.equal(router.locationData.url, '/inner');
    assert.equal(document.title, 'Inner');
    assert.deepEqual(focused, ['#inner']);
    assert.deepEqual(history, [['/inner', 'Inner', 'https://example.test/inner']]);

    router.navigate('/next');
    assert.deepEqual(calls, ['outer:init', 'outer:destroy', 'inner:init', 'inner:destroy', 'next']);
});

test('a mediator navigation dispatched during initialize() owns the final lifecycle', t => {
    const {history} = browser(t);
    const router = new Router();
    const mediator = new EventTarget();
    const calls = [];
    router.mediator = mediator;
    router.routes = {
        '/start': {view: {
            initialize() {
                calls.push('start:init');
                mediator.dispatchEvent(new CustomEvent('router:navigate', {detail: {url: '/redirect', reason: 'login'}}));
            },
            destroy: () => calls.push('start:destroy')
        }},
        '/redirect': {view: {initialize: () => calls.push('redirect:init'), destroy: () => calls.push('redirect:destroy')}},
        '/next': () => calls.push('next')
    };
    router.addListeners();
    router.navigate('/start');
    assert.equal(router.route, '/redirect');
    assert.equal(router.locationData.data.mediator.reason, 'login');
    assert.deepEqual(history.map(entry => entry[0]), ['/redirect']);
    router.navigate('/next');
    assert.deepEqual(calls, ['start:init', 'start:destroy', 'redirect:init', 'redirect:destroy', 'next']);
    router.destroy();
});

test('a navigation started inside destroy() runs once and supersedes the outer navigation', t => {
    const {history} = browser(t);
    const router = new Router();
    const calls = [];
    router.routes = {
        '/a': {view: {initialize: () => calls.push('a:init'), destroy() {calls.push('a:destroy'); router.navigate('/c');}}},
        '/b': () => calls.push('b'),
        '/c': () => calls.push('c')
    };
    router.navigate('/a');
    assert.equal(router.navigate('/b'), router);
    assert.deepEqual(calls, ['a:init', 'a:destroy', 'c']);
    assert.equal(router.route, '/c');
    assert.deepEqual(history.map(entry => entry[0]), ['/a', '/c']);
});

test('a throwing initialize() keeps its lifecycle owned so destroy() runs before the next route', t => {
    const {history} = browser(t);
    const router = new Router();
    const calls = [];
    router.routes = {
        '/page': () => calls.push('page'),
        '/broken': {view: {initialize() {calls.push('broken:init'); throw new Error('render failed');}, destroy: () => calls.push('broken:destroy')}},
        '/next': () => calls.push('next')
    };
    router.navigate('/page');
    assert.throws(() => router.navigate('/broken'), /render failed/);
    assert.equal(router.route, '/broken');
    assert.equal(history.length, 1);
    router.navigate('/next');
    assert.deepEqual(calls, ['page', 'broken:init', 'broken:destroy', 'next']);
});

test('SVG push-state links use their string href', t => {
    browser(t);
    const router = new Router();
    router.routes = {'/svg': () => true};
    const event = click('/svg');
    const anchor = event.target.closest('a[href][data-pushstate]');
    anchor.href = {baseVal: '/svg', animVal: '/svg'};
    assert.equal(router.eventPushStateClick(event), router);
    assert.equal(event.prevented, true);
    assert.equal(router.route, '/svg');
});

test('unmatched links stay native when only the built-in default route exists', t => {
    const {history} = browser(t);
    const router = new Router();
    const event = click('/unmatched');
    assert.equal(router.eventPushStateClick(event), true);
    assert.equal(event.prevented, false);
    assert.equal(history.length, 0);
    // Programmatic navigation keeps using the built-in default route.
    assert.equal(router.navigate('/unmatched'), router);
    assert.equal(router.route, 'defaultRoute');

    const configured = new Router();
    configured.routes = {defaultRoute: () => true};
    const handled = click('/unmatched');
    assert.equal(configured.eventPushStateClick(handled), configured);
    assert.equal(handled.prevented, true);
});

test('guard-rejected link clicks fall back to native navigation', t => {
    const {history} = browser(t);
    const router = new Router();
    let guardCalls = 0;
    router.routes = {
        '/private': {secure: () => {guardCalls++; return false;}, view: () => true},
        '/throwing-guard': {secure: () => {throw new Error('guard failed');}, view: () => true},
        '/throwing-view': () => {throw new Error('view failed');}
    };
    const rejected = click('/private');
    assert.equal(router.eventPushStateClick(rejected), true);
    assert.equal(rejected.prevented, false);
    assert.equal(guardCalls, 1);
    assert.equal(history.length, 0);

    const guardError = click('/throwing-guard');
    assert.throws(() => router.eventPushStateClick(guardError), /guard failed/);
    assert.equal(guardError.prevented, false);

    // Once a route has committed, the link must not also navigate natively.
    const viewError = click('/throwing-view');
    assert.throws(() => router.eventPushStateClick(viewError), /view failed/);
    assert.equal(viewError.prevented, true);
});

test('fragment-only popstate does not re-run the active route or move focus', t => {
    const {focused} = browser(t, '/doc');
    const router = new Router();
    const calls = [];
    router.routes = {
        '/doc': {view: {initialize: () => calls.push('doc:init'), destroy: () => calls.push('doc:destroy')}},
        '/other': () => calls.push('other')
    };
    router.initialize();
    window.location.hash = '#footnote';
    assert.equal(router.eventPopState(), router);
    assert.deepEqual(calls, ['doc:init']);
    assert.deepEqual(focused, []);
    assert.equal(router.url, '/doc#footnote');
    assert.equal(router.locationData.url, '/doc#footnote');

    window.location.hash = '';
    window.location.search = '?page=2';
    router.eventPopState();
    assert.deepEqual(calls, ['doc:init', 'doc:destroy', 'doc:init']);
    window.location.pathname = '/other';
    router.eventPopState();
    assert.deepEqual(calls, ['doc:init', 'doc:destroy', 'doc:init', 'doc:destroy', 'other']);
    router.destroy();
});

test('initial dispatch does not move focus; later navigation does', t => {
    const {focused} = browser(t, '/page');
    const router = new Router();
    router.routes = {'/page': {title: 'Page', view: () => true}, '/next': {view: () => true}};
    router.initialize();
    assert.equal(document.title, 'Page');
    assert.deepEqual(focused, []);
    router.navigate('/next');
    assert.deepEqual(focused, ['main h1']);
    router.destroy();
});

test('route keys match their WHATWG-encoded path form', t => {
    browser(t);
    const router = new Router();
    const calls = [];
    router.routes = {
        '/café': (_scope, location) => calls.push(['cafe', location.data.url]),
        '/caf': () => calls.push(['caf'])
    };
    assert.equal(router.navigate('/café/menu'), router);
    assert.equal(router.route, '/café');
    assert.equal(router.navigate('/caf%C3%A9'), router);
    assert.deepEqual(calls, [['cafe', ['menu']], ['cafe', []]]);
    const event = click('/caf%C3%A9/x');
    router.eventPushStateClick(event);
    assert.equal(event.prevented, true);
    assert.deepEqual(calls.at(-1), ['cafe', ['x']]);
});

test('equivalent encoded route keys resolve deterministically', () => {
    const router = new Router();
    const calls = [];
    router.routes = {
        '/x/../same': () => calls.push('dot'),
        '/same': () => calls.push('plain'),
        '/y/../same': () => calls.push('other-dot')
    };
    router.navigate('/same');
    router.routes = {'/y/../same': () => calls.push('y'), '/x/../same': () => calls.push('x')};
    router.navigate('/same');
    assert.deepEqual(calls, ['plain', 'x']);
});

test('server absolute request URLs expose the path-and-query location contract', t => {
    const previousWindow = global.window;
    delete global.window;
    t.after(() => {if (previousWindow !== undefined) {global.window = previousWindow;}});
    const router = new Router();
    const locations = [];
    router.routes = {
        '/products': (_scope, location) => locations.push(location),
        defaultRoute: (_scope, location) => locations.push(location)
    };
    router.initialize('https://example.com/products/42?color=blue');
    assert.equal(router.url, '/products/42?color=blue');
    assert.equal(locations[0].url, '/products/42?color=blue');

    // A stored '//' path must keep its path meaning when re-dispatched or rebuilt.
    router.navigate('https://example.com//evil.test/products');
    assert.equal(router.url, '//evil.test/products');
    assert.equal(router.route, 'defaultRoute');
    assert.equal(router.navigate(), router);
    assert.equal(router.route, 'defaultRoute');
    assert.deepEqual(router.locationData.data.url, ['evil.test', 'products']);
    router.setLocationData({source: 'rebuild'});
    assert.deepEqual(router.locationData.data.url, ['evil.test', 'products']);
});

test('a navigation started by focus handling supersedes the outer history entry', t => {
    const {history} = browser(t);
    const router = new Router();
    router.routes = {'/first': {view: () => true}, '/second': {focus: false, view: () => true}};
    document.querySelector = () => ({hasAttribute: () => true, focus() {router.navigate('/second');}});
    router.navigate('/first');
    assert.equal(router.route, '/second');
    assert.deepEqual(history.map(entry => entry[0]), ['/second']);
});

test('route keys that cannot be pathnames stay inert, and rebuilt location data survives table replacement', () => {
    const router = new Router();
    router.routes = {'products': () => true, '/a?b': () => true, '/a#b': () => true, defaultRoute: () => true};
    for (const url of ['/products', '/a?b', '/a']) {
        router.navigate(url);
        assert.equal(router.route, 'defaultRoute', url);
    }
    router.routes = {'/café': () => true};
    router.navigate('/café/menu');
    router.routes = {};
    router.setLocationData();
    assert.deepEqual(router.locationData.data.url, ['menu']);
});

test('rebuilding location data under an opaque browser origin keeps the previous payload', t => {
    browser(t);
    const router = new Router();
    router.routes = {'/page': () => true};
    router.navigate('/page');
    const previous = router.locationData;
    window.location.origin = 'null';
    router.setLocationData();
    assert.equal(router.locationData, previous);
});
