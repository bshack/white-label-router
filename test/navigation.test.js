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
    router.mediator = {on() {}};
    router.addListeners(); router.removeListeners();
    router.boundMediatorNavigate();
    router.boundMediatorNavigate({url: '/mediator'});
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
    assert.equal(router.navigate('/empty'), false);
    assert.equal(router.navigate('/missing'), false);
    assert.equal(router.navigate('/unknown'), router);
    router.navigate('/object/%E0%A4%A');
    assert.deepEqual(router.locationData.data.url, ['%E0%A4%A']);
    router.previousRoute = '/empty';
    router.navigate('/object');
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
    router.navigate = () => navigations++;
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
