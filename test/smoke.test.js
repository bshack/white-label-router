'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

test('exports the Router constructor', function() {
    // Gator exposes its browser global while the module is loaded.
    global.window = {};
    const Router = require('../dist/index');

    assert.equal(typeof Router, 'function');
    delete global.window;
});
