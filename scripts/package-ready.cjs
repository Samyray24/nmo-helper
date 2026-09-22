const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const readyRoot = path.join(root, 'ГОТОВЫЕ ВЕРСИИ');
const releases = path.join(root, 'releases');
const version = require('../package.json').version;

function assertInside(base, target) {
  const relative = path.relative(base, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Unsafe path: ${target}`);
  }
}

function resetDirectory(target, source) {
  assertInside(readyRoot, target);
  if (fs.existsSync(target)) fs.rmSync(target, {recursive: true, force: true});
  copyDirectory(source, target);
}

function copyDirectory(source, target) {
  fs.mkdirSync(target, {recursive: true});
  for (const entry of fs.readdirSync(source, {withFileTypes: true})) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) copyDirectory(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

function replaceVersionInInstructions(directory) {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) replaceVersionInInstructions(file);
    else if (entry.isFile() && entry.name.endsWith('.txt')) {
      const current = fs.readFileSync(file, 'utf8');
      fs.writeFileSync(file, current.replace(/5\.\d+\.\d+/g, version));
    }
  }
}

function replacePackage(directory, sourceName, targetName, cleanup = true) {
  assertInside(readyRoot, directory);
  if (cleanup) {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      if (entry.isFile() && /^NMO Helper \d+\.\d+\.\d+ - .+\.(?:zip|xpi|crx|tar\.gz)$/.test(entry.name)) {
        fs.rmSync(path.join(directory, entry.name));
      }
    }
  }
  fs.copyFileSync(path.join(releases, sourceName), path.join(directory, targetName));
}

const winYandex = path.join(readyRoot, '01 - Windows', '01 - Яндекс Браузер');
const winChromium = path.join(readyRoot, '01 - Windows', '02 - Chrome Chromium Edge Brave Opera Vivaldi');
const winFirefox = path.join(readyRoot, '01 - Windows', '03 - Firefox');
const linuxEsr = path.join(readyRoot, '02 - Linux', '01 - Astra Linux - Firefox ESR');
const linuxFirefox = path.join(readyRoot, '02 - Linux', '02 - Firefox современный');
const linuxChromium = path.join(readyRoot, '02 - Linux', '03 - Chromium Chrome Edge Brave Opera Vivaldi');
const safari = path.join(readyRoot, '03 - macOS', '01 - Safari - исходники для Xcode');
const all = path.join(readyRoot, '04 - Один архив со всем');

resetDirectory(path.join(winChromium, 'Распакованное расширение'), path.join(root, 'dist', 'chrome'));
resetDirectory(path.join(winFirefox, 'Распакованное расширение'), path.join(root, 'dist', 'firefox'));
resetDirectory(path.join(linuxEsr, 'Распакованное расширение'), path.join(root, 'dist', 'firefox-legacy'));
resetDirectory(path.join(linuxFirefox, 'Распакованное расширение'), path.join(root, 'dist', 'firefox'));
resetDirectory(path.join(linuxChromium, 'Распакованное расширение'), path.join(root, 'dist', 'chrome'));
resetDirectory(path.join(safari, 'Исходники WebExtension'), path.join(root, 'dist', 'firefox-legacy'));

const safariManifestFile = path.join(safari, 'Исходники WebExtension', 'manifest.json');
const safariManifest = JSON.parse(fs.readFileSync(safariManifestFile, 'utf8'));
delete safariManifest.browser_specific_settings;
safariManifest.name = 'NMO Helper';
fs.writeFileSync(safariManifestFile, JSON.stringify(safariManifest, null, 2) + '\n');

replacePackage(winYandex, `nmo-helper-yandex-windows-linux-${version}.crx`, `NMO Helper ${version} - Яндекс Браузер.crx`);
replacePackage(winChromium, `nmo-helper-chromium-${version}.zip`, `NMO Helper ${version} - Chromium.zip`);
replacePackage(winFirefox, `nmo-helper-firefox-${version}-unsigned.xpi`, `NMO Helper ${version} - Firefox - неподписанный.xpi`);
replacePackage(linuxEsr, `nmo-helper-firefox-esr-${version}-unsigned.xpi`, `NMO Helper ${version} - Astra Linux Firefox ESR - неподписанный.xpi`);
replacePackage(linuxFirefox, `nmo-helper-firefox-${version}-unsigned.xpi`, `NMO Helper ${version} - Firefox - неподписанный.xpi`);
replacePackage(linuxChromium, `nmo-helper-chromium-${version}.zip`, `NMO Helper ${version} - Chromium Linux.zip`);
replacePackage(safari, `nmo-helper-safari-source-${version}.zip`, `NMO Helper ${version} - Safari исходники.zip`);
replacePackage(all, `nmo-helper-all-browsers-${version}.zip`, `NMO Helper ${version} - все браузеры.zip`);
replacePackage(all, `nmo-helper-linux-${version}.tar.gz`, `NMO Helper ${version} - Linux комплект.tar.gz`, false);

replaceVersionInInstructions(readyRoot);

const hashFile = path.join(all, 'SHA256 - проверка файлов.txt');
const hashes = fs.readdirSync(all, {withFileTypes: true})
  .filter(entry => entry.isFile() && /\.(?:zip|tar\.gz)$/.test(entry.name))
  .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  .map(entry => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(all, entry.name))).digest('hex')}  ${entry.name}`);
fs.writeFileSync(hashFile, hashes.join('\n') + '\n');

for (const entry of fs.readdirSync(releases, {withFileTypes: true})) {
  if (!entry.isFile()) continue;
  const versionMatch = entry.name.match(/(\d+\.\d+\.\d+)/);
  if (versionMatch && versionMatch[1] !== version && /^(?:nmo-helper-|SHA256SUMS-)/.test(entry.name)) {
    const file = path.join(releases, entry.name);
    assertInside(releases, file);
    fs.rmSync(file);
  }
}

const releaseHashFile = path.join(releases, `SHA256SUMS-${version}.txt`);
const releaseHashes = fs.readdirSync(releases, {withFileTypes: true})
  .filter(entry => entry.isFile() && !entry.name.startsWith('SHA256SUMS-'))
  .sort((a, b) => a.name.localeCompare(b.name, 'en'))
  .map(entry => `${crypto.createHash('sha256').update(fs.readFileSync(path.join(releases, entry.name))).digest('hex')}  ${entry.name}`);
fs.writeFileSync(releaseHashFile, releaseHashes.join('\n') + '\n');

console.log(`[OK] ГОТОВЫЕ ВЕРСИИ обновлены до ${version}`);
