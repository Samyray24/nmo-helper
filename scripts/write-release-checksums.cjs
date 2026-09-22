const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const releases = path.join(root, 'releases');
const version = require('../package.json').version;
const output = path.join(releases, `SHA256SUMS-${version}.txt`);

fs.mkdirSync(releases, {recursive: true});
const lines = fs.readdirSync(releases, {withFileTypes: true})
	.filter(entry => entry.isFile() && !entry.name.startsWith('SHA256SUMS-'))
	.sort((a, b) => a.name.localeCompare(b.name, 'en'))
	.map(entry => {
		const data = fs.readFileSync(path.join(releases, entry.name));
		return `${crypto.createHash('sha256').update(data).digest('hex')}  ${entry.name}`;
	});

fs.writeFileSync(output, `${lines.join('\n')}\n`);
console.log(`[OK] ${path.basename(output)} (${lines.length} files)`);
