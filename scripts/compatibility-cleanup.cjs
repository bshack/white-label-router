'use strict';
const fs = require('node:fs');
const path = require('node:path');

function update(file, transform) {
    const before = fs.readFileSync(file, 'utf8');
    const after = transform(before);
    if (after === before) throw new Error(`Expected compatibility changes were not found in ${file}`);
    fs.writeFileSync(file, after);
}

update('src/index.ts', source => {
    const expected = [
        ['removeListener?(event: string, callback:', 'removeListener(event: string, callback:'],
        ['navigate(url?: string | false, mediatorData?: NavigationData, isPopState = false)', 'navigate(url?: string, mediatorData?: NavigationData, isPopState = false)'],
        ['this.navigate(false, {}, true)', 'this.navigate(undefined, {}, true)'],
        ['this.navigate(false, {}, false)', 'this.navigate(undefined, {}, false)'],
        ["if (this.mediator && typeof this.mediator.removeListener === 'function') {", 'if (this.mediator) {']
    ];
    for (const [from, to] of expected) {
        if (!source.includes(from)) throw new Error(`Missing router compatibility text: ${from}`);
        source = source.split(from).join(to);
    }
    return source;
});

for (const directory of ['test', 'test-types']) {
    if (!fs.existsSync(directory)) continue;
    for (const name of fs.readdirSync(directory)) {
        const file = path.join(directory, name);
        if (!fs.statSync(file).isFile()) continue;
        const before = fs.readFileSync(file, 'utf8');
        const after = before
            .split('.navigate(false,').join('.navigate(undefined,')
            .split('navigate(false,').join('navigate(undefined,');
        if (after !== before) fs.writeFileSync(file, after);
    }
}

update('README.md', source => {
    const marker = '## Install and import\n';
    if (!source.includes(marker)) throw new Error('README install marker not found');
    source = source.replace(marker,
        '## Versioning policy\n\nBackward compatibility is not maintained through sentinel arguments, optional adapter methods, aliases, or runtime fallbacks. Breaking public API changes are communicated with a Semantic Versioning major release and documented migration notes.\n\n### Version 5 migration\n\n`navigate()` no longer accepts `false` as a sentinel URL; omit the URL or pass `undefined` when routing the current URL. A configured mediator must provide both `on()` and `removeListener()` so router teardown can always release its subscription. No compatibility adapters are retained.\n\n' + marker
    );
    return source;
});

update('package.json', source => {
    const data = JSON.parse(source);
    if (data.version !== '4.1.0') throw new Error(`Unexpected package version ${data.version}`);
    data.version = '5.0.0';
    return JSON.stringify(data, null, 2) + '\n';
});
