'use strict';
// Real-Chromium checks for the link, history, and focus behavior the Node tests can only stub.
// Run with `npm run test:browser` after `npm run build`; it is deliberately not part of `npm test`.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');

const routerSource = fs.readFileSync(path.join(__dirname, '../../dist/index.js'), 'utf8');

function page(crossOrigin) {
    return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Fixture</title></head>
<body>
<nav><a id="outside" href="/b" data-pushstate>Outside the navigation root</a></nav>
<main>
<h1>Fixture heading</h1>
<div id="region">
<a id="to-b" href="/b" data-pushstate>B</a>
<a id="to-c" href="/c?x=1" data-pushstate>C</a>
<a id="blank" href="/b" target="_blank" data-pushstate>B in a new tab</a>
<a id="download" href="/b" download data-pushstate>Download B</a>
<a id="cross" href="${crossOrigin}/b" data-pushstate>B on another origin</a>
<a id="unmatched" href="/nowhere" data-pushstate>Unmatched</a>
<a id="guarded" href="/private" data-pushstate>Guarded</a>
<a id="hash" href="#section" data-pushstate>Jump to section</a>
<svg width="80" height="20"><a id="svg" href="/svg" data-pushstate><text x="0" y="15">SVG link</text></a></svg>
</div>
<p id="section" style="margin-top: 3000px">Section</p>
</main>
<script>var module = {exports: {}};</script>
<script src="/router.js"></script>
<script>
window.calls = [];
const RouterClass = module.exports;
const router = new RouterClass();
const record = name => (_scope, location) => window.calls.push(name + ' ' + location.url);
router.routes = {
    '/a': record('a'),
    '/b': {view: {initialize: record('b'), destroy: record('b:destroy')}},
    '/c': record('c'),
    '/svg': record('svg'),
    '/private': {secure: () => false, view: record('private')}
};
window.router = router;
router.initialize();
</script>
</body>
</html>`;
}

let server;
let browser;
let origin;
let crossOrigin;

test.before(async () => {
    server = http.createServer((request, response) => {
        if (request.url === '/router.js') {
            response.writeHead(200, {'content-type': 'text/javascript'});
            response.end(routerSource);
            return;
        }
        if (request.url === '/favicon.ico') {
            response.writeHead(404);
            response.end();
            return;
        }
        response.writeHead(200, {'content-type': 'text/html; charset=utf-8'});
        response.end(page(crossOrigin));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const {port} = server.address();
    origin = `http://127.0.0.1:${port}`;
    // Same server, different host name, so it is a genuinely different origin.
    crossOrigin = `http://localhost:${port}`;
    browser = await chromium.launch({executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined});
});

test.after(async () => {
    await browser?.close();
    await new Promise(resolve => server ? server.close(resolve) : resolve());
});

/** Open a fresh page at `/a`, marked so a native (document-replacing) navigation can be detected. */
async function open(t) {
    const context = await browser.newContext();
    t.after(() => context.close());
    const tab = await context.newPage();
    await tab.goto(`${origin}/a`);
    await tab.evaluate(() => {window.sameDocument = true;});
    return {context, tab};
}

const state = tab => tab.evaluate(() => ({
    sameDocument: window.sameDocument === true,
    calls: window.calls,
    url: window.router.url,
    href: window.location.href,
    historyLength: window.history.length,
    active: document.activeElement && (document.activeElement.id || document.activeElement.tagName.toLowerCase())
}));

/** Assert the click below was left to the browser: the page navigated natively and Router handled nothing. */
async function assertNativeLoad(tab, expectedPath) {
    await tab.waitForURL(url => new URL(url).pathname === expectedPath);
    await tab.waitForLoadState('load');
    const after = await state(tab);
    assert.equal(after.sameDocument, false, 'the document was replaced by a native navigation');
}

test('a plain left click on a data-pushstate link is intercepted and pushes history', async t => {
    const {tab} = await open(t);
    const before = await state(tab);
    assert.deepEqual(before.calls, ['a /a']);
    await tab.click('#to-c');
    const after = await state(tab);
    assert.equal(after.sameDocument, true);
    assert.equal(after.href, `${origin}/c?x=1`);
    assert.equal(after.url, '/c?x=1');
    assert.deepEqual(after.calls, ['a /a', 'c /c?x=1']);
    assert.equal(after.historyLength, before.historyLength + 1);
});

test('SVG <a> links are intercepted', async t => {
    const {tab} = await open(t);
    await tab.click('#svg text');
    const after = await state(tab);
    assert.equal(after.sameDocument, true);
    assert.equal(after.href, `${origin}/svg`);
    assert.deepEqual(after.calls, ['a /a', 'svg /svg']);
});

for (const [name, options] of [
    ['Ctrl', {modifiers: ['Control']}],
    ['Shift', {modifiers: ['Shift']}],
    ['middle', {button: 'middle'}]
]) {
    test(`a ${name} click stays native and opens the link elsewhere`, async t => {
        const {context, tab} = await open(t);
        const opened = context.waitForEvent('page');
        await tab.click('#to-b', options);
        const other = await opened;
        await other.waitForURL(`${origin}/b`);
        const after = await state(tab);
        assert.equal(after.sameDocument, true);
        assert.equal(after.href, `${origin}/a`);
        assert.deepEqual(after.calls, ['a /a']);
    });
}

test('a Meta click is not intercepted', async t => {
    const {tab} = await open(t);
    const historyLength = (await state(tab)).historyLength;
    await tab.click('#to-b', {modifiers: ['Meta']});
    // What Meta does natively is platform-specific; Router must simply not handle it.
    const after = await state(tab);
    if (after.sameDocument) {
        assert.deepEqual(after.calls, ['a /a']);
        assert.equal(after.historyLength, historyLength);
    }
});

test('target=_blank opens a native popup', async t => {
    const {tab} = await open(t);
    const popup = tab.waitForEvent('popup');
    await tab.click('#blank');
    await (await popup).waitForURL(`${origin}/b`);
    assert.deepEqual((await state(tab)).calls, ['a /a']);
});

test('a download link downloads natively', async t => {
    const {tab} = await open(t);
    const download = tab.waitForEvent('download');
    await tab.click('#download');
    assert.equal(new URL((await download).url()).pathname, '/b');
    const after = await state(tab);
    assert.equal(after.sameDocument, true);
    assert.deepEqual(after.calls, ['a /a']);
});

test('cross-origin, unmatched, and guard-rejected links load natively', async t => {
    const {tab} = await open(t);
    await tab.click('#cross');
    await tab.waitForURL(`${crossOrigin}/b`);
    assert.equal(await tab.evaluate(() => window.sameDocument === true), false);

    for (const [selector, expectedPath] of [['#unmatched', '/nowhere'], ['#guarded', '/private']]) {
        await tab.goto(`${origin}/a`);
        await tab.evaluate(() => {window.sameDocument = true;});
        await tab.click(selector);
        await assertNativeLoad(tab, expectedPath);
    }
});

test('back and forward re-run routes through real popstate', async t => {
    const {tab} = await open(t);
    await tab.click('#to-b');
    await tab.click('#to-c');
    await tab.goBack();
    await tab.waitForFunction(() => window.router.url === '/b');
    await tab.goForward();
    await tab.waitForFunction(() => window.router.url === '/c?x=1');
    await tab.goBack();
    await tab.goBack();
    await tab.waitForFunction(() => window.router.url === '/a');
    const after = await state(tab);
    assert.equal(after.sameDocument, true);
    assert.deepEqual(after.calls, [
        'a /a', 'b /b', 'b:destroy /c?x=1', 'c /c?x=1', 'b /b', 'b:destroy /c?x=1', 'c /c?x=1', 'b /b', 'b:destroy /a', 'a /a'
    ]);
});

test('fragment-only link clicks and back/forward do not re-run the route or move focus', async t => {
    const {tab} = await open(t);
    await tab.click('#to-b');
    await tab.evaluate(() => document.activeElement.blur());
    await tab.click('#hash');
    await tab.waitForFunction(() => window.router.url === '/b#section');
    let after = await state(tab);
    assert.equal(after.href, `${origin}/b#section`);
    assert.deepEqual(after.calls, ['a /a', 'b /b']);
    assert.notEqual(after.active, 'h1');
    await tab.goBack();
    await tab.waitForFunction(() => window.router.url === '/b');
    after = await state(tab);
    assert.equal(after.sameDocument, true);
    assert.deepEqual(after.calls, ['a /a', 'b /b']);
    assert.notEqual(after.active, 'h1');
});

test('focus moves to main h1 after navigation but not on initial load', async t => {
    const {tab} = await open(t);
    const initial = await tab.evaluate(() => ({
        active: document.activeElement.tagName.toLowerCase(),
        tabindex: document.querySelector('main h1').getAttribute('tabindex')
    }));
    assert.deepEqual(initial, {active: 'body', tabindex: null});
    await tab.click('#to-b');
    const after = await tab.evaluate(() => ({
        active: document.activeElement.tagName.toLowerCase(),
        tabindex: document.querySelector('main h1').getAttribute('tabindex')
    }));
    assert.deepEqual(after, {active: 'h1', tabindex: '-1'});
});

test('navigationRoot limits interception to its region', async t => {
    const {tab} = await open(t);
    await tab.evaluate(() => {window.router.navigationRoot = document.getElementById('region');});
    await tab.click('#to-c');
    assert.deepEqual((await state(tab)).calls, ['a /a', 'c /c?x=1']);
    await tab.click('#outside');
    await assertNativeLoad(tab, '/b');
});

test('a mediator event without a destination re-runs the route without a duplicate history entry', async t => {
    const {tab} = await open(t);
    await tab.click('#to-b');
    const before = await state(tab);
    await tab.evaluate(() => {
        const mediator = new EventTarget();
        window.router.mediator = mediator;
        mediator.dispatchEvent(new CustomEvent('router:navigate'));
    });
    const after = await state(tab);
    assert.deepEqual(after.calls, [...before.calls, 'b:destroy /b', 'b /b']);
    assert.equal(after.historyLength, before.historyLength);
});
