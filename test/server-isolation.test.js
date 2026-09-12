'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Router = require('../dist');

test('separate server router instances isolate request navigation state', () => {
    const first = new Router();
    const second = new Router();
    first.routes = {'/users': () => true};
    second.routes = {'/orders': () => true};

    first.initialize('/users/1?request=first');
    second.initialize('/orders/2?request=second');

    assert.equal(first.route, '/users');
    assert.equal(first.url, '/users/1?request=first');
    assert.deepEqual(first.locationData.data.url, ['1']);
    assert.deepEqual(first.locationData.data.query, {request: 'first'});

    assert.equal(second.route, '/orders');
    assert.equal(second.url, '/orders/2?request=second');
    assert.deepEqual(second.locationData.data.url, ['2']);
    assert.deepEqual(second.locationData.data.query, {request: 'second'});
});
