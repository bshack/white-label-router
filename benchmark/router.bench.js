'use strict';
// Router hot-path benchmark: matchRoute, navigate, and data-pushstate click handling with 10 and 1,000 routes.
//   npm run benchmark                    full run, prints a table
//   npm run bench:ci                     short run, compared with benchmark/baseline.json
//   node benchmark/router.bench.js --ci --update-baseline   re-record the baseline (run `npm run build` first)
// Run after `npm run build`; it measures the built dist/.
const fs = require('node:fs');
const path = require('node:path');
const Router = require('../dist');

const ci = process.argv.includes('--ci');
const updateBaseline = process.argv.includes('--update-baseline');
const baselinePath = path.join(__dirname, 'baseline.json');
// Fail only when an operation is this many times slower than the baseline, so shared CI runners don't flake.
const tolerance = 3;
const scale = ci ? 0.1 : 1;
const samples = ci ? 3 : 5;

/** Median ns/op over `samples` timed runs, after a warm-up. `fn` returns a count so work can't be optimized away. */
function time(iterations, fn) {
    iterations = Math.max(500, Math.round(iterations * scale));
    let count = 0;
    for (let i = 0; i < Math.min(iterations, 2000); i++) {count += fn(i);}
    const runs = [];
    for (let run = 0; run < samples; run++) {
        const start = process.hrtime.bigint();
        for (let i = 0; i < iterations; i++) {count += fn(i);}
        runs.push(Number(process.hrtime.bigint() - start) / iterations);
    }
    runs.sort((a, b) => a - b);
    return {nsPerOp: runs[Math.floor(samples / 2)], count};
}

/** A route table with `size` keys: half `/sectionN`, half `/sectionN/detail`, plus a configured defaultRoute. */
function routeTable(size, onRoute) {
    const routes = {};
    for (let i = 0; i < size / 2; i++) {
        routes[`/section${i}`] = onRoute;
        routes[`/section${i}/detail`] = onRoute;
    }
    routes.defaultRoute = onRoute;
    return routes;
}

/** 128 request paths: deep matches spread across the table, and misses that fall through to defaultRoute. */
function requestPaths(size) {
    const paths = [];
    for (let i = 0; i < 64; i++) {paths.push(`/section${(i * 37) % (size / 2)}/detail/${i}`, `/missing${i}`);}
    return paths;
}

const results = {};
const counters = {};
// Each size also runs with indexRoutes(), labeled 'indexed', to show what skipping the per-match key scan saves.
const sizes = [10, 1000];
const variants = sizes.flatMap(size => [{size, indexed: false, label: `${size} routes`}, {size, indexed: true, label: `${size} routes indexed`}]);

// Server runtime first: no window/document, so navigate() has no history or focus work.
for (const {size, indexed, label} of variants) {
    let routeCalls = 0;
    const router = new Router();
    router.routes = routeTable(size, () => {routeCalls++;});
    if (indexed) {router.indexRoutes();}
    const paths = requestPaths(size);
    const iterations = size === 10 ? 200000 : 5000;
    const match = time(iterations, i => router.matchRoute(paths[i & 127]) === 'defaultRoute' ? 1 : 0);
    results[`matchRoute ${label}`] = match.nsPerOp;
    counters[`matchRoute ${label}: defaultRoute matches`] = match.count;
    routeCalls = 0;
    results[`navigate ${label}`] = time(iterations / 2, i => router.navigate(`${paths[i & 127]}?q=1`) === router ? 1 : 0).nsPerOp;
    counters[`navigate ${label}: route calls`] = routeCalls;
}

// Browser runtime with minimal stubs: measures click eligibility checks, matching, and navigation.
global.window = {location: {origin: 'https://bench.test', href: 'https://bench.test/', pathname: '/', search: '', hash: ''}, history: {pushState() {}}, addEventListener() {}, removeEventListener() {}};
global.document = {title: '', baseURI: 'https://bench.test/', addEventListener() {}, removeEventListener() {}, querySelector() {return null;}};
for (const {size, indexed, label} of variants) {
    const router = new Router();
    router.routes = routeTable(size, () => true);
    if (indexed) {router.indexRoutes();}
    const events = requestPaths(size).map(href => {
        const anchor = {getAttribute: name => name === 'href' ? href : null, hasAttribute: () => false};
        return {button: 0, target: {closest: () => anchor}, preventDefault() {}};
    });
    const click = time(size === 10 ? 100000 : 5000, i => router.eventPushStateClick(events[i & 127]) === router ? 1 : 0);
    results[`click ${label}`] = click.nsPerOp;
    counters[`click ${label}: intercepted`] = click.count;
}
delete global.window;
delete global.document;

console.log(`Router benchmark (${ci ? 'short CI run' : 'full run'}, Node ${process.version})`);
for (const [name, ns] of Object.entries(results)) {console.log(`${name.padEnd(32)} ${ns.toFixed(0).padStart(7)} ns/op`);}

if (!ci) {process.exit(0);}

if (updateBaseline) {
    fs.writeFileSync(baselinePath, `${JSON.stringify({node: process.version, tolerance, nsPerOp: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, Math.round(v)])), counters}, null, 2)}\n`);
    console.log(`Wrote ${path.relative(process.cwd(), baselinePath)}`);
    process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const failures = [];
for (const [name, ns] of Object.entries(results)) {
    const expected = baseline.nsPerOp[name];
    if (expected === undefined) {failures.push(`${name}: missing from baseline`);} else if (ns > expected * tolerance) {
        failures.push(`${name}: ${ns.toFixed(0)} ns/op is more than ${tolerance}x the ${expected} ns/op baseline`);
    }
}
// Counters depend only on the iteration counts and routing results, so they must match exactly.
for (const [name, value] of Object.entries(counters)) {
    if (baseline.counters[name] !== value) {failures.push(`${name}: ${value}, baseline ${baseline.counters[name]}`);}
}
if (failures.length) {
    console.error(`\nBenchmark regression:\n- ${failures.join('\n- ')}`);
    process.exit(1);
}
console.log(`\nWithin ${tolerance}x of benchmark/baseline.json; counters match.`);
