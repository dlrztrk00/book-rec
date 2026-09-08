// Uctan uca deneme: sahte bir Goodreads kutuphanesi + anket cevaplari -> oneriler.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Book, Dataset } from '../src/lib/dataset.ts';
import { importGoodreadsCsv } from '../src/lib/goodreads.ts';
import { derivePrefs, type Answers } from '../src/lib/questions.ts';
import { recommend } from '../src/lib/recommend.ts';

const OUT = join(process.cwd(), 'public', 'data');
const j = (p: string) => JSON.parse(readFileSync(join(OUT, p), 'utf8'));

function buildDataset(): Dataset {
  const booksRaw = j('books.json'), facetsRaw = j('facets.json'), meta = j('meta.json');
  const simBuf = readFileSync(join(OUT, 'sim.bin'));
  const facetBuf = readFileSync(join(OUT, 'facets.bin'));
  const N = simBuf.readUInt32LE(8), K = simBuf.readUInt32LE(12);
  const simIds = new Uint16Array(simBuf.buffer, simBuf.byteOffset + 16, N * K);
  const simScore = new Uint8Array(simBuf.buffer, simBuf.byteOffset + 16 + N * K * 2, N * K);
  const facetBytes = new Uint8Array(facetBuf.buffer, facetBuf.byteOffset, facetBuf.length);
  const F = facetsRaw.facets.length;
  const genreNames: string[] = booksRaw.genres;

  const books: Book[] = new Array(N + 1);
  const all: Book[] = [];
  const byGoodreadsId = new Map<number, number>();
  for (const r of booksRaw.books as any[][]) {
    const b: Book = { id: r[0], gr: r[1], title: r[2], authors: r[3], year: r[4], pages: r[5],
      avg: r[6], count: r[7], genres: (r[8] as number[]).map((i) => genreNames[i]),
      series: r[9], seriesNo: r[10], likes: r[11], tags: r[12] };
    books[b.id] = b; all.push(b); if (b.gr) byGoodreadsId.set(b.gr, b.id);
  }
  return {
    books, all, facets: facetsRaw.facets, meta, byGoodreadsId,
    neighbors(id) {
      const out = []; const off = (id - 1) * K;
      for (let k = 0; k < K; k++) { const n = simIds[off + k]; if (!n) break; out.push({ id: n, score: simScore[off + k] / 255 }); }
      return out;
    },
    facetValue: (id, fi) => facetBytes[(id - 1) * F + fi] / 255,
    facetVector(id) { const v = new Float32Array(F); const o = (id - 1) * F; for (let i = 0; i < F; i++) v[i] = facetBytes[o + i] / 255; return v; },
    descriptionOf: async () => null,
  };
}

const ds = buildDataset();
const find = (q: string) => ds.all.find((b) => b.title.toLowerCase().includes(q.toLowerCase()));

// --- sahte Goodreads disa aktarimi
const favs = ['Norwegian Wood', 'Kafka on the Shore', 'The Road', 'Beloved', 'Never Let Me Go',
              'The Bell Jar', 'Slaughterhouse-Five', 'A Little Life', 'The Remains of the Day'];
const likes = ['1984', 'Lolita', 'Blood Meridian', 'The Handmaid', 'The Secret History'];
const meh = ['Twilight', 'Fifty Shades of Grey'];
const rows = [['Book Id', 'Title', 'Author', 'My Rating', 'Exclusive Shelf', 'Date Read'].join(',')];
let matchedFixtures = 0;
const push = (q: string, rating: number, shelf = 'read') => {
  const b = find(q);
  if (!b) { console.log(`  (fixture bulunamadi: ${q})`); return; }
  matchedFixtures++;
  rows.push([b.gr, `"${b.title.replace(/"/g, '""')}"`, `"${b.authors[0]}"`, rating, shelf, '2024/01/01'].join(','));
};
favs.forEach((t) => push(t, 5));
likes.forEach((t) => push(t, 4));
meh.forEach((t) => push(t, 2));

const imported = importGoodreadsCsv(rows.join('\n'), ds);
console.log(`\nKUTUPHANE: ${imported.entries.length}/${matchedFixtures} kitap eslesti, ${imported.unmatched.length} eslesmedi`);
console.log('  eslesme yontemi:', JSON.stringify(imported.entries.reduce((a: any, e) => { a[e.matchedBy] = (a[e.matchedBy] || 0) + 1; return a; }, {})));

const senaryolar: { ad: string; a: Answers }[] = [
  { ad: 'Karanlik + edebi + yavas, tek kitap', a: {
      mood: 'thinky', tone: 0, pace: 1, depth: 4, kind: 'fiction',
      genres: ['literary', 'realistic'], series: 'standalone', novelty: 'safe', popularity: 'any' } },
  { ad: 'Hafif kacis, hizli, seri olabilir', a: {
      mood: 'comfort', tone: 4, pace: 4, depth: 0, kind: 'fiction',
      genres: ['fantasy', 'scifi'], series: 'first', novelty: 'wild', popularity: 'any', avoid: ['dark'] } },
  { ad: 'Kurgu disi, fikir, kisa', a: {
      mood: 'learn', kind: 'nonfiction', genres: ['ideas'], length: 'short',
      novelty: 'stretch', popularity: 'hidden' } },
];

for (const s of senaryolar) {
  const recs = recommend(ds, imported.entries, derivePrefs(s.a), 5);
  console.log(`\n■ ${s.ad}  -> ${recs.length} oneri`);
  for (const r of recs) {
    console.log(`  ${String(r.match).padStart(3)}%  ${r.book.title.slice(0, 44).padEnd(46)} ${(r.book.authors[0] ?? '').slice(0, 20)}`);
    console.log(`        uyan: ${r.matched.join(', ') || '-'}${r.missed.length ? ' | eksik: ' + r.missed.join(', ') : ''}`);
    if (r.seeds.length) console.log(`        cunku: ${r.seeds.map((x) => x.book.title.slice(0, 26)).join(' / ')}`);
  }
}

// --- saglik kontrolleri
console.log('\nSAGLIK KONTROLLERI');
const check = (ok: boolean, m: string) => console.log(`  ${ok ? 'OK  ' : 'HATA'} ${m}`);
const base = recommend(ds, imported.entries, derivePrefs(senaryolar[0].a), 12);
const readIds = new Set(imported.entries.filter((e) => e.shelf === 'read').map((e) => e.bookId));
check(base.every((r) => !readIds.has(r.book.id)), 'okunmus kitaplar onerilmiyor');
check(base.every((r) => r.book.seriesNo === 0), 'tek-kitap filtresi calisiyor');
check(new Set(base.map((r) => r.book.authors[0])).size >= base.length - 2, 'yazar cesitliligi korunuyor');
check(base.every((r) => r.match >= 0 && r.match <= 100), 'eslesme yuzdesi 0-100 araliginda');
check(base[0].match > base[base.length - 1].match, 'siralama azalan');
const noLib = recommend(ds, [], derivePrefs(senaryolar[0].a), 5);
check(noLib.length === 5 && noLib.every((r) => r.parts.taste === 0), 'kutuphanesiz de calisiyor (gecmis payi 0)');
const avoided = recommend(ds, imported.entries, derivePrefs({ ...senaryolar[0].a, avoid: ['dark', 'romance'] }), 10);
const fi = new Map(ds.facets.map((f, i) => [f.id, i]));
check(avoided.every((r) => ds.facetValue(r.book.id, fi.get('dark')!) <= 0.55), 'kacinilan boyut sert filtreleniyor');
