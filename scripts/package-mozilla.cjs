const fs = require('node:fs');
const path = require('node:path');
const {zipSync} = require('fflate');
const root = path.resolve(__dirname, '..');
const version = require('../package.json').version;
const out = path.join(root, 'ГОТОВЫЕ ВЕРСИИ', '05 - Firefox - комплект для подписи Mozilla');
const releases = path.join(root, 'releases');
fs.mkdirSync(out, {recursive: true});
fs.mkdirSync(releases, {recursive: true});
function files(directory, prefix = '') {
  const result = {};
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const name = prefix + entry.name;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) Object.assign(result, files(target, name + '/'));
    else if (entry.isFile()) result[name] = fs.readFileSync(target);
  }
  return result;
}
function zip(name, entries) {
  const archive = zipSync(entries, {level: 6, mtime: new Date('2020-01-01T00:00:00Z')});
  fs.writeFileSync(path.join(out, name), archive);
  fs.writeFileSync(path.join(releases, name), archive);
}
for (const [folder, suffix] of [['firefox-store', 'modern'], ['firefox-legacy', 'esr']]) {
  const entries = files(path.join(root, 'dist', folder));
  const manifest = JSON.parse(entries['manifest.json'].toString());
  manifest.browser_specific_settings.gecko.id = `nmo-helper-samyray24-${suffix}@extension`;
  entries['manifest.json'] = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
  zip(`mozilla-${suffix}-${version}-UNSIGNED.zip`, entries);
}
const sources = {};
for (const folder of ['src', 'scripts', 'docs', 'tests']) Object.assign(sources, files(path.join(root, folder), folder + '/'));
for (const name of ['package.json', 'package-lock.json', 'build.js', 'tsconfig.json', 'LICENSE', 'AUTHORS.md', 'README.md']) sources[name] = fs.readFileSync(path.join(root, name));
zip(`mozilla-sources-${version}.zip`, sources);
fs.copyFileSync(path.join(root, 'docs', 'MOZILLA_SIGNING.md'), path.join(out, 'КАК ПОЛУЧИТЬ ПОДПИСЬ.md'));
console.log(`[OK] Mozilla submission kit ${version}: ${out}`);
