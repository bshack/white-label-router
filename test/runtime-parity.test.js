'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Router = require('../dist');

function installBrowserGlobals() {
    const previousWindow = global.window;
    const previousDocument = global.document;
    global.window = {
        location: {
            origin: 'https://example.test',
            href: 'https://example.test/products/42?allow=yes&color=blue#details',
            pathname: '/products/42',
            search: '?allow=yes&color=blue',
            hash: '#details'
        },
        history: {pushState() {}},
        addEventListener() {},
        removeEventListener() {}
    };
    global.document = {
        title: '',
        addEventListener() {},
        removeEventListener() {},
        querySelector() {return null;}
    };
    return () => {
        if (previousWindow === undefined) {delete global.window;} else {global.window = previousWindow;}
        if (previousDocument === undefined) {delete global.document;} else {global.document = previousDocument;}
    };
}

function removeBrowserGlobals() {
    const previousWindow = global.window;
    const previousDocument = global.document;
    delete global.window;
    delete global.document;
    return () => {
        if (previousWindow === undefined) {delete global.window;} else {global.window = previousWindow;}
        if (previousDocument === undefined) {delete global.document;} else {global.document = previousDocument;}
    };
}

function runContract(url) {
    const calls = [];
    const router = new Router();
    router.routes = {
        '/products': {
            title: 'Products',
            secure: (_scope, location) => location.data.query.allow === 'yes',
            view: (_scope, location) => calls.push({
                route: 'products',
                path: location.data.url.slice(),
                query: {...location.data.query}
            })
        },
        defaultRoute: (_scope, location) => calls.push({
            route: 'default',
            path: location.data.url.slice(),
            query: {...location.data.query}
        })
    };
    router.initialize(url);
    const result = {
        route: router.route,
        title: router.pageTitle,
        location: {
            url: router.locationData.url,
            path: router.locationData.data.url.slice(),
            query: {...router.locationData.data.query}
        },
        calls
    };
    router.destroy();
    return result;
}

test('browser and server runtimes expose the same route contract', () => {
    const url = '/products/42?allow=yes&color=blue#details';

    const restoreBrowser = installBrowserGlobals();
    const browserResult = runContract(undefined);
    restoreBrowser();

    const restoreServer = removeBrowserGlobals();
    const serverResult = runContract(url);
    restoreServer();

    assert.deepEqual(serverResult, browserResult);
    assert.deepEqual(serverResult, {
        route: '/products',
        title: 'Products',
        location: {
            url,
            path: ['42'],
            query: {allow: 'yes', color: 'blue'}
        },
        calls: [{
            route: 'products',
            path: ['42'],
            query: {allow: 'yes', color: 'blue'}
        }]
    });
});
