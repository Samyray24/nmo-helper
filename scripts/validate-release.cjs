const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {unzipSync, strFromU8} = require('fflate');

const root = path.resolve(__dirname, '..');
const releases = path.join(root, 'releases');
const ready = path.join(root, 'ГОТОВЫЕ ВЕРСИИ');
const version = require('../package.json').version;
const errors = [];

function fail(message) { errors.push(message); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

for (const name of ['manifest.chrome.json', 'manifest.firefox.json', 'manifest.firefox-store.json', 'manifest.firefox-legacy.json']) {
  const manifest = readJson(path.join(root, 'src', name));
  if (manifest.version !== version) fail(`${name}: expected ${version}, got ${manifest.version}`);
  const required = manifest.host_permissions || manifest.permissions || [];
  if (required.includes('<all_urls>')) fail(`${name}: required <all_urls> is forbidden`);
}

for (const folder of ['chrome', 'firefox', 'firefox-store', 'firefox-legacy']) {
  const file = path.join(root, 'dist', folder, 'manifest.json');
  if (!fs.existsSync(file)) fail(`missing ${file}`);
  else if (readJson(file).version !== version) fail(`dist/${folder}: wrong version`);
}

const archives = [
  [`nmo-helper-chromium-${version}.zip`, 3],
  [`nmo-helper-firefox-${version}-unsigned.xpi`, 3],
  [`nmo-helper-firefox-esr-${version}-unsigned.xpi`, 2],
];
for (const [name, manifestVersion] of archives) {
  const file = path.join(releases, name);
  if (!fs.existsSync(file)) { fail(`missing ${name}`); continue; }
  try {
    const entries = unzipSync(new Uint8Array(fs.readFileSync(file)));
    const manifest = JSON.parse(strFromU8(entries['manifest.json']));
    if (manifest.version !== version || manifest.manifest_version !== manifestVersion) fail(`${name}: invalid manifest`);
  } catch (error) { fail(`${name}: ${error.message}`); }
}

const crxFile = path.join(releases, `nmo-helper-yandex-windows-linux-${version}.crx`);
if (!fs.existsSync(crxFile)) fail('missing CRX3');
else {
  const crx = fs.readFileSync(crxFile);
  if (crx.toString('ascii', 0, 4) !== 'Cr24' || crx.readUInt32LE(4) !== 3) fail('invalid CRX3 header');
}

const sumsFile = path.join(releases, `SHA256SUMS-${version}.txt`);
if (!fs.existsSync(sumsFile)) fail('missing SHA256SUMS');
else for (const line of fs.readFileSync(sumsFile, 'utf8').trim().split(/\r?\n/)) {
  const match = line.match(/^([0-9a-f]{64})  (.+)$/);
  if (!match) { fail(`invalid SHA line: ${line}`); continue; }
  const file = path.join(releases, match[2]);
  if (!fs.existsSync(file)) { fail(`SHA target missing: ${match[2]}`); continue; }
  const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (actual !== match[1]) fail(`SHA mismatch: ${match[2]}`);
}

for (const base of [releases, ready]) {
  if (!fs.existsSync(base)) continue;
  walk(base, file => {
    const match = path.basename(file).match(/(\d+\.\d+\.\d+)/);
    if (match && match[1] !== version && /NMO Helper|nmo-helper|SHA256SUMS/.test(path.basename(file))) fail(`old artifact: ${file}`);
  });
}

const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
if (!readme.startsWith(`# NMO Helper v${version}`)) fail('README heading version mismatch');

if (errors.length) {
  console.error(errors.map(error => `[FAIL] ${error}`).join('\n'));
  process.exit(1);
}
console.log(`[OK] release ${version}: manifests, archives, CRX3 and SHA-256 verified`);

function walk(directory, callback) {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file, callback);
    else if (entry.isFile()) callback(file);
  }
}
