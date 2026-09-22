const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const version = require('../package.json').version;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid package version');
const releases = path.join(root, 'releases');
const name = `nmo-helper-linux-${version}`;
const archive = path.join(releases, `${name}.tar.gz`);

function run(command, args) {
  const result = spawnSync(command, args, {cwd: root, stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}

function copyDir(source, destination) {
  fs.mkdirSync(destination, {recursive: true});
  for (const entry of fs.readdirSync(source, {withFileTypes: true})) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

if (!process.argv.includes('--skip-build')) run(process.execPath, [path.join(root, 'build.js')]);
fs.mkdirSync(releases, {recursive: true});
const staging = fs.mkdtempSync(path.join(releases, '.linux-'));
try {
  const bundle = path.join(staging, name);
  fs.mkdirSync(bundle);
	for (const browser of [
		{source: 'chrome', target: 'chromium'},
		{source: 'firefox', target: 'firefox'},
		{source: 'firefox-legacy', target: 'firefox-esr'},
	]) {
		copyDir(path.join(root, 'dist', browser.source), path.join(bundle, browser.target));
	}
  fs.copyFileSync(path.join(root, 'LINUX.md'), path.join(bundle, 'LINUX.md'));
  fs.copyFileSync(path.join(root, 'LICENSE'), path.join(bundle, 'LICENSE'));
  run('tar', ['-czf', archive, '-C', staging, name]);
  console.log(`[OK] ${archive}`);
} finally {
  // Delete only the temporary directory created inside releases above.
  const relative = path.relative(releases, staging);
  if (!relative.startsWith('.linux-') || relative.includes(path.sep) || path.isAbsolute(relative)) {
    throw new Error('Unsafe staging directory');
  }
  fs.rmSync(staging, {recursive: true, force: true});
}
