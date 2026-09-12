'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('public package entrypoint resolves from built output', () => {
    const Router = require('white-label-router');
    assert.equal(typeof Router, 'function');
});
