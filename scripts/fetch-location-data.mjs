import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const url = 'https://raw.githubusercontent.com/DevelopedbyWill/thailand-canonical-admin-names/main/data/v1.0.0/thailand-adm1-provinces-v1.0.0.csv';
const response = await fetch(url);
if (!response.ok) throw Error(`Coordinate download failed: ${response.status}`);
const text = await response.text();
// RFC4180 fields, including quoted commas and newlines.
const rows = []; let row = [], field = '', quoted = false;
for (let i = 0; i < text.length; i++) {
  const c = text[i];
  if (c === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++; } else quoted = !quoted; }
  else if (c === ',' && !quoted) { row.push(field); field = ''; }
  else if (c === '\n' && !quoted) { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
  else field += c;
}
if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
const header = rows.shift();
const value = (r, name) => r[header.indexOf(name)];
const centers = Object.fromEntries(rows.filter(r => r.length > 1).map(r => {
  const code = value(r, 'tis1099_code');
  const lat = Number(value(r, 'centroid_lat')), lon = Number(value(r, 'centroid_lon'));
  if (!/^\d{2}$/.test(code) || lat < 5 || lat > 21 || lon < 97 || lon > 106) throw Error(`Invalid coordinate: ${code}`);
  return [code, { lat, lon }];
}));
if (Object.keys(centers).length !== 77) throw Error('Expected 77 province centers');
await mkdir('public/data', { recursive: true });
await writeFile('public/data/province-centers.js', `// Province centroids, not exact birthplaces. Derived from CC BY 4.0 data.\n// Credit: DevelopedbyWill/thailand-canonical-admin-names v1.0.0. See THIRD_PARTY_NOTICES.md.\nexport const provinceCenters = ${JSON.stringify(centers, null, 2)};\n`);
await writeFile('public/data/province-centers.source.json', JSON.stringify({url,sha256:createHash('sha256').update(text).digest('hex'),license:'CC-BY-4.0',changes:'Retained TIS code and province centroid latitude/longitude only.'},null,2));
console.log('Prepared 77 province centroid coordinates with provenance.');
