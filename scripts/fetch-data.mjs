// Veri indirme. Iki ayri kaynaktan ayni cekirdek dosyalari ceker ki
// verify-data.mjs bunlarin ayni olup olmadigini ispatlayabilsin.
import { createHash } from 'node:crypto';
import { mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'data', 'raw');

// Kanonik kaynak: goodbooks-10k (zygmuntz) - CC BY-SA 4.0
const CANON = 'https://raw.githubusercontent.com/zygmuntz/goodbooks-10k/master';
// Turev kaynak: sadece aciklama/tur alanlari icin - CC BY-SA 4.0
const EXT = 'https://raw.githubusercontent.com/malcolmosh/goodbooks-10k-extended/master';

const FILES = [
  ['canon/ratings.csv', `${CANON}/ratings.csv`],
  ['canon/book_tags.csv', `${CANON}/book_tags.csv`],
  ['canon/tags.csv', `${CANON}/tags.csv`],
  ['canon/to_read.csv', `${CANON}/to_read.csv`],
  ['canon/books.csv', `${CANON}/books.csv`],
  ['ext/ratings.csv', `${EXT}/ratings.csv`],
  ['ext/book_tags.csv', `${EXT}/book_tags.csv`],
  ['ext/tags.csv', `${EXT}/tags.csv`],
  ['ext/to_read.csv', `${EXT}/to_read.csv`],
  ['ext/books_enriched.csv', `${EXT}/books_enriched.csv`],
];

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const mb = (n) => (n / 1048576).toFixed(1) + ' MB';

async function fetchOne([rel, url]) {
  const dest = join(RAW, rel);
  await mkdir(dirname(dest), { recursive: true });
  try {
    const buf = await readFile(dest);
    return { rel, url, bytes: buf.length, sha256: sha256(buf), cached: true };
  } catch { /* indirilecek */ }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`${rel}: HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return { rel, url, bytes: buf.length, sha256: sha256(buf), cached: false };
}

const results = [];
for (const f of FILES) {
  const r = await fetchOne(f);
  results.push(r);
  console.log(`${r.cached ? 'onbellek' : 'indirildi'}  ${r.rel.padEnd(26)} ${mb(r.bytes).padStart(9)}  ${r.sha256.slice(0, 16)}...`);
}
await writeFile(join(RAW, 'checksums.json'), JSON.stringify(results, null, 2));
console.log(`\nToplam ${mb(results.reduce((a, r) => a + r.bytes, 0))} -> data/raw/  (checksums.json yazildi)`);
