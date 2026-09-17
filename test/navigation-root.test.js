'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Router = require('../dist');

function browser(t) {
    const documentListeners = new Map();
    global.window = {
        location: {
            origin: 'https://example.test',
            href: 'https://example.test/',
            pathname: '/',
            search: '',
            hash: ''
        },
        history: {pushState() {}},
        addEventListener() {},
        removeEventListener() {}
    };
    global.document = {
        title: '',
        addEventListener(type, listener) {documentListeners.set(type, listener);},
        removeEventListener(type, listener) {
            if (documentListeners.get(type) === listener) {documentListeners.delete(type);}
        },
        querySelector() {return null;}
    };
    t.after(() => {delete global.window; delete global.document;});
    return documentListeners;
}

function root() {
    let clickListener;
    let addCount = 0;
    return {
        addEventListener(type, listener) {
            if (type === 'click') {clickListener = listener; addCount++;}
        },
        removeEventListener(type, listener) {
            if (type === 'click' && clickListener === listener) {clickListener = undefined;}
        },
        dispatch(event) {clickListener?.(event);},
        get hasClickListener() {return typeof clickListener === 'function';},
        get addCount() {return addCount;}
    };
}

function click(url) {
    const anchor = {
        getAttribute(name) {return name === 'href' ? url : null;},
        hasAttribute() {return false;}
    };
    return {
        button: 0,
        target: {closest: () => anchor},
        preventDefault() {}
    };
}

test('navigationRoot scopes progressive link interception and can move while active', t => {
    const documentListeners = browser(t);
    const first = root();
    const second = root();
    const router = new Router();
    router.routes = {'/first': () => true, '/second': () => true};

    assert.equal(router.navigationRoot, null);
    router.navigationRoot = first;
    router.navigationRoot = first;
    assert.equal(router.navigationRoot, first);
    router.addListeners();

    assert.equal(first.hasClickListener, true);
    assert.equal(documentListeners.has('click'), false);
    first.dispatch(click('/first'));
    assert.equal(router.url, '/first');

    router.navigationRoot = second;
    assert.equal(first.hasClickListener, false);
    assert.equal(second.hasClickListener, true);
    assert.equal(second.addCount, 1);
    first.dispatch(click('/second'));
    assert.equal(router.url, '/first');
    second.dispatch(click('/second'));
    assert.equal(router.url, '/second');

    router.navigationRoot = null;
    assert.equal(second.hasClickListener, false);
    assert.equal(documentListeners.has('click'), true);
    router.removeListeners();
    assert.equal(documentListeners.has('click'), false);
});

test('navigationRoot can be configured in a non-browser lifecycle', () => {
    const router = new Router();
    const configuredRoot = root();
    router.addListeners();
    router.navigationRoot = configuredRoot;
    assert.equal(router.navigationRoot, configuredRoot);
    router.removeListeners();
});
