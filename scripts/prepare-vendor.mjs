import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const source = new URL('../node_modules/@swisseph/browser/dist/', import.meta.url);
const target = new URL('../public/vendor/swisseph/', import.meta.url);
await mkdir(target, { recursive: true });
const hashes = {};
for (const name of ['swisseph-browser.js', 'swisseph.js', 'swisseph.wasm']) {
  await copyFile(new URL(name, source), new URL(name, target));
  hashes[name] = createHash('sha256').update(await readFile(new URL(name, target))).digest('hex');
}
await writeFile(new URL('manifest.json', target), JSON.stringify({
  package: '@swisseph/browser', version: '1.4.0', license: 'AGPL-3.0',
  source: 'https://github.com/swisseph-js/swisseph', hashes,
}, null, 2));
console.log('Prepared local Swiss Ephemeris WASM assets.');
