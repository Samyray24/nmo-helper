const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');

const root = path.resolve(__dirname, '..');
const version = require('../package.json').version;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid package version');
const name = `nmo-helper-yandex-windows-linux-${version}`;
const releases = path.join(root, 'releases');
const candidates = [process.env.CHROME_BIN,
  path.join(process.env.ProgramFiles || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env.LOCALAPPDATA || 'C:/', 'Google/Chrome/Application/chrome.exe'),
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
];
const browser = candidates.find(candidate => candidate && fs.existsSync(candidate));
if (!browser) throw new Error('Install Chrome/Chromium or set CHROME_BIN');

function run(command, args) {
  const result = spawnSync(command, args, {cwd: root, stdio: 'inherit', windowsHide: true, timeout: 120000});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}
function copyDir(source, destination) {
  fs.mkdirSync(destination, {recursive: true});
  for (const entry of fs.readdirSync(source, {withFileTypes: true})) {
    const from = path.join(source, entry.name), to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

if (!process.argv.includes('--skip-build')) run(process.execPath, [path.join(root, 'build.js')]);
const keyDir = path.join(os.homedir(), '.codex', 'nmo-helper-signing');
const keyFile = path.join(keyDir, 'nmo-helper.pem');
fs.mkdirSync(keyDir, {recursive: true, mode: 0o700});
if (!fs.existsSync(keyFile)) {
  const {privateKey} = crypto.generateKeyPairSync('rsa', {modulusLength: 2048});
  fs.writeFileSync(keyFile, privateKey.export({type: 'pkcs8', format: 'pem'}), {mode: 0o600, flag: 'wx'});
}
const publicKey = crypto.createPublicKey(fs.readFileSync(keyFile)).export({type: 'spki', format: 'der'});
fs.mkdirSync(releases, {recursive: true});
const staging = fs.mkdtempSync(path.join(releases, '.yandex-'));
try {
  const extension = path.join(staging, name);
  copyDir(path.join(root, 'dist', 'chrome'), extension);
  fs.copyFileSync(path.join(root, 'INSTALL.md'), path.join(extension, 'INSTALL.md'));
  fs.copyFileSync(path.join(root, 'LICENSE'), path.join(extension, 'LICENSE'));
  const manifestFile = path.join(extension, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  manifest.key = publicKey.toString('base64');
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  run(browser, [`--pack-extension=${extension}`, `--pack-extension-key=${keyFile}`,
    `--user-data-dir=${path.join(staging, 'profile')}`, '--no-message-box', '--no-first-run']);
  const crx = fs.readFileSync(`${extension}.crx`);
  if (crx.toString('ascii', 0, 4) !== 'Cr24' || crx.readUInt32LE(4) !== 3) throw new Error('Expected CRX3');
  const offset = 12 + crx.readUInt32LE(8);
  if (offset >= crx.length || crx.readUInt32LE(offset) !== 0x04034b50) throw new Error('Invalid ZIP payload');
  fs.writeFileSync(path.join(releases, `${name}.crx`), crx);
  fs.writeFileSync(path.join(releases, `${name}.zip`), crx.subarray(offset));
  console.log(`[OK] ${name}.crx and ${name}.zip -> releases/`);
} finally {
  const relative = path.relative(releases, staging);
  if (!relative.startsWith('.yandex-') || relative.includes(path.sep) || path.isAbsolute(relative)) throw new Error('Unsafe staging path');
  fs.rmSync(staging, {recursive: true, force: true});
}
