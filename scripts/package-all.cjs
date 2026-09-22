const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const {zipSync} = require('fflate');

const root = path.resolve(__dirname, '..');
const version = require('../package.json').version;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Invalid package version');
const releases = path.join(root, 'releases');
function run(command, args) {
  const result = spawnSync(command, args, {cwd: root, stdio: 'inherit', windowsHide: true, timeout: 120000});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}
function readFiles(directory, prefix = '') {
  const files = {};
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const relative = prefix + entry.name;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) Object.assign(files, readFiles(file, relative + '/'));
    else if (entry.isFile()) {
      if (/\.(pem|crx|xpi|zip)$/i.test(entry.name)) throw new Error('Unexpected file in extension: ' + relative);
      files[relative] = fs.readFileSync(file);
    } else throw new Error('Unsupported filesystem entry: ' + relative);
  }
  return files;
}
function encodeManifest(files, mutate) {
  const manifest = JSON.parse(files['manifest.json'].toString('utf8'));
  mutate(manifest);
  files['manifest.json'] = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
}
function zip(files) { return zipSync(files, {level: 6, mtime: new Date('2020-01-01T00:00:00Z')}); }

run(process.execPath, [path.join(root, 'build.js')]);
fs.mkdirSync(releases, {recursive: true});
const browserCandidates = [process.env.CHROME_BIN,
  path.join(process.env.ProgramFiles || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
  path.join(process.env.LOCALAPPDATA || 'C:/', 'Google/Chrome/Application/chrome.exe'),
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
const browser = browserCandidates.find(candidate => candidate && fs.existsSync(candidate));
if (browser) run(process.execPath, [path.join(root, 'scripts/package-yandex.cjs'), '--skip-build']);

const chromium = readFiles(path.join(root, 'dist/chrome'));
const keyFile = path.join(os.homedir(), '.codex/nmo-helper-signing/nmo-helper.pem');
if (fs.existsSync(keyFile)) {
  const publicKey = crypto.createPublicKey(fs.readFileSync(keyFile)).export({type: 'spki', format: 'der'});
  encodeManifest(chromium, manifest => { manifest.key = publicKey.toString('base64'); });
}
const firefox = readFiles(path.join(root, 'dist/firefox'));
encodeManifest(firefox, manifest => { manifest.browser_specific_settings.gecko.id = 'nmo-helper-modern-local@extension'; });
const legacy = readFiles(path.join(root, 'dist/firefox-legacy'));
const safari = readFiles(path.join(root, 'dist/firefox-legacy'));
encodeManifest(safari, manifest => { delete manifest.browser_specific_settings; manifest.name = 'NMO Helper'; });

const instructions = fs.readFileSync(path.join(root, 'BROWSERS.md'));
const license = fs.readFileSync(path.join(root, 'LICENSE'));
const kit = {'BROWSERS.md': instructions, LICENSE: license};
const variants = [
  {folder: 'chromium', files: chromium, name: `nmo-helper-chromium-${version}.zip`},
  {folder: 'firefox', files: firefox, name: `nmo-helper-firefox-${version}-unsigned.xpi`},
  {folder: 'firefox-esr', files: legacy, name: `nmo-helper-firefox-esr-${version}-unsigned.xpi`},
  {folder: 'safari-source', files: safari, name: `nmo-helper-safari-source-${version}.zip`},
];
for (const variant of variants) {
  variant.files['BROWSERS.md'] = instructions;
  variant.files.LICENSE = license;
  const archive = zip(variant.files);
  fs.writeFileSync(path.join(releases, variant.name), archive);
  if (variant.folder !== 'safari-source') kit[variant.name] = archive;
  for (const [name, data] of Object.entries(variant.files)) kit[`${variant.folder}/${name}`] = data;
  console.log(`[OK] ${variant.name}`);
}
if (browser) {
  const crxName = `nmo-helper-yandex-windows-linux-${version}.crx`;
  kit[crxName] = fs.readFileSync(path.join(releases, crxName));
}
const kitName = `nmo-helper-all-browsers-${version}.zip`;
fs.writeFileSync(path.join(releases, kitName), zip(kit));
console.log(`[OK] ${kitName}`);
