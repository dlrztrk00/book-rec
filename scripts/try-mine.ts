// Gercek bir Goodreads disa aktarimiyla motoru calistirir.
//   npm run try -- ~/Downloads/goodreads_library_export.csv [--live]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Book, Dataset } from '../src/lib/dataset.ts';
import { makeFacetsFromSubjects } from '../src/lib/facetMatch.ts';
import { importGoodreadsCsv } from '../src/lib/goodreads.ts';
import { derivePrefs, type Answers } from '../src/lib/questions.ts';
import { recommend } from '../src/lib/recommend.ts';
import { fetchFresh, type FreshBook } from '../src/lib/openlibrary.ts';

if (typeof globalThis.localStorage === 'undefined') {
  const m = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}

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
    facetsFromSubjects: makeFacetsFromSubjects(facetsRaw.facets),
    descriptionOf: async () => null,
  };
}

const path = process.argv[2];
const live = process.argv.includes('--live');
if (!path) { console.error('kullanim: npm run try -- <csv yolu> [--live]'); process.exit(1); }

const ds = buildDataset();
const res = importGoodreadsCsv(readFileSync(path, 'utf8'), ds);

const rated = res.entries.filter((e) => e.myRating > 0);
const loved = res.entries.filter((e) => e.myRating >= 4);
console.log(`\nDOSYA: ${path.replace(process.env.HOME ?? '', '~')}`);
console.log(`  ${res.totalRows} satir okundu`);
console.log(`  ${res.entries.length} kitap veri setiyle eslesti  (%${Math.round(100 * res.entries.length / Math.max(res.totalRows, 1))})`);
console.log(`  ${res.unmatched.length} kitap havuzda yok`);
console.log(`  eslesenlerin ${rated.length} tanesi puanli, ${loved.length} tanesi 4+ yildiz  <- oneri gucu buradan gelir`);
console.log(`  eslesme yontemi: ${JSON.stringify(res.entries.reduce((a: any, e) => { a[e.matchedBy] = (a[e.matchedBy] ?? 0) + 1; return a; }, {}))}`);

if (loved.length) {
  console.log(`\n  Sevdigin kitaplardan bazilari (motorun tohumlari):`);
  for (const e of loved.slice(0, 8)) {
    const b = ds.books[e.bookId];
    console.log(`    ${e.myRating}* ${b.title.slice(0, 44).padEnd(46)} ${(b.authors[0] ?? '').slice(0, 20)}`);
  }
}
if (res.unmatched.length) {
  console.log(`\n  Havuzda olmayanlardan ornekler:`);
  for (const u of res.unmatched.slice(0, 6)) console.log(`    - ${u.title.slice(0, 46)}`);
}

const profiles: { ad: string; a: Answers }[] = [
  { ad: 'NOTR (hicbir anket cevabi yok, sadece gecmisin)', a: {} },
  { ad: 'Karisik / dengeli', a: { mood: 'gripping', kind: 'either', freshness: 'balanced', novelty: 'stretch' } },
  { ad: 'Agirlikli yeni cikanlar', a: { mood: 'gripping', kind: 'either', freshness: 'new', novelty: 'stretch' } },
];

let fresh: FreshBook[] = [];
if (live) {
  const p0 = derivePrefs(profiles[1].a);
  const top = Object.entries(p0.facetWeights).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  fresh = await fetchFresh(ds, top);
  console.log(`\n  Open Library: ${fresh.length} yeni aday getirildi`);
}

for (const p of profiles) {
  const recs = recommend(ds, res.entries, derivePrefs(p.a), 8, fresh);
  console.log(`\n■ ${p.ad}`);
  if (!recs.length) { console.log('   (oneri cikmadi)'); continue; }
  for (const r of recs) {
    console.log(`   ${String(r.match).padStart(3)}% ${r.isNew ? `YENI ${r.book.year}` : '         '} ${r.book.title.slice(0, 42).padEnd(44)} ${(r.book.authors[0] ?? '').slice(0, 18)}`);
    if (r.seeds.length) console.log(`        cunku: ${r.seeds.map((s) => s.book.title.slice(0, 24)).join(' / ')}`);
  }
}
