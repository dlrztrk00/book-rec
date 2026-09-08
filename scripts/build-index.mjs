// Ham CSV -> tarayicinin dogrudan okuyacagi kompakt veri dosyalari.
// Cikti public/data/ altina yazilir; site calisirken hicbir aga istek atmaz.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsvObjects, parsePyList } from './lib/csv.mjs';
import { FACETS, NOISE } from './facets.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'data', 'raw');
const OUT = join(ROOT, 'public', 'data');
const t0 = Date.now();
const log = (m) => console.log(`[${String(((Date.now() - t0) / 1000).toFixed(1)).padStart(6)}s] ${m}`);

const N = 10000;              // kitap sayisi
const K = 40;                 // kitap basina saklanacak komsu sayisi
const LIKE_MIN = 4;           // "begendi" esigi
const MIN_CO = 5;             // en az kac ortak okur
const POP_DAMP = +(process.env.POP_DAMP || 0.65);   // populerlik cezasi ussu
const SHRINK = 10;            // az veriye guvenmeme katsayisi
const MAX_PER_USER = 400;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'desc'), { recursive: true });

// ---------------------------------------------------------------- metin temizligi
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”' };
const CTRL = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]', 'g');

function clean(s) {
  if (!s) return '';
  let out = String(s);
  out = out.replace(/<[^>]{0,200}>/g, ' ');                          // HTML etiketleri
  out = out.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d));
  out = out.replace(/&([a-z]+);/gi, (m, e) => ENTITIES[e.toLowerCase()] ?? ' ');
  out = out.replace(/https?:\/\/\S+/gi, ' ');                        // URL'ler
  out = out.replace(/\bwww\.\S+/gi, ' ');
  out = out.replace(CTRL, ' ');
  out = out.replace(/([a-z"'\)\]])([.!?])([A-Z])/g, '$1$2 $3');      // kazima kaynakli yapisik cumleler
  return out.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------- kitaplar
log('kitaplar okunuyor...');
// Cekirdek kunye (baslik, yazar, yil, puan) KANONIK dosyadan gelir: zenginlestirilmis
// dosyanin authors sutunu 198 satirda hatali. Oradan sadece aciklama/tur/sayfa alinir.
const rows = parseCsvObjects(readFileSync(join(RAW, 'ext', 'books_enriched.csv'), 'utf8'));
const canonRows = parseCsvObjects(readFileSync(join(RAW, 'canon', 'books.csv'), 'utf8'));
const canon = new Map(canonRows.map((r) => [+r.book_id, r]));

const genreList = [];
const genreIdx = new Map();
const SERIES_RE = /\s*\(([^()]{2,80}?),?\s*#(\d+(?:\.\d+)?)\)\s*$/;

const books = new Array(N + 1);
const grToId = new Map();
const descriptions = new Map();

for (const r of rows) {
  const id = +r.book_id;
  if (!Number.isInteger(id) || id < 1 || id > N) continue;
  const c = canon.get(id);
  if (!c) continue;

  const rawTitle = clean(c.title);
  const m = SERIES_RE.exec(rawTitle);
  const title = m ? rawTitle.slice(0, m.index).trim() : rawTitle;
  const series = m ? clean(m[1]).replace(/\s*#$/, '') : '';
  const seriesNo = m ? Math.round(parseFloat(m[2])) : 0;

  const genres = [];
  for (const g of parsePyList(r.genres)) {
    if (!/^[a-z0-9-]{2,30}$/.test(g)) continue;
    if (!genreIdx.has(g)) { genreIdx.set(g, genreList.length); genreList.push(g); }
    genres.push(genreIdx.get(g));
  }

  const year = Math.round(+c.original_publication_year) || 0;
  books[id] = {
    id,
    gr: +c.goodreads_book_id || 0,
    title,
    authors: String(c.authors || '').split(',').map((a) => clean(a).replace(/^\[|\]$/g, '').trim())
      .filter(Boolean).slice(0, 3),
    year: year > 0 && year < 2100 ? year : 0,
    pages: Math.round(+r.pages) || 0,
    avg: Math.round((+c.average_rating || 0) * 100) / 100,
    count: Math.round(+c.ratings_count) || 0,
    genres,
    series,
    seriesNo,
  };
  grToId.set(+c.goodreads_book_id, id);
  const d = clean(r.description);
  if (d.length > 40) descriptions.set(id, d.slice(0, 2600));
}
const missing = [];
for (let i = 1; i <= N; i++) if (!books[i]) missing.push(i);
if (missing.length) throw new Error(`eksik kitap id: ${missing.slice(0, 5)}`);
log(`${N} kitap, ${descriptions.size} ozet, ${genreList.length} tur`);

// ---------------------------------------------------------------- boyut puanlari
log('boyut puanlari hesaplaniyor...');
const tagName = new Map();
for (const t of parseCsvObjects(readFileSync(join(RAW, 'canon', 'tags.csv'), 'utf8'))) tagName.set(+t.tag_id, t.tag_name);

const exactMap = new Map();   // etiket adi -> boyut indeksleri
FACETS.forEach((f, fi) => f.tags.forEach((t) => {
  if (!exactMap.has(t)) exactMap.set(t, []);
  exactMap.get(t).push(fi);
}));
const isNoise = (name) => NOISE.some((re) => re.test(name));

const F = FACETS.length;
const facetRaw = new Float32Array((N + 1) * F);
const bookTagRaw = new Map();  // bookId -> [[name, count]]

{
  const lines = readFileSync(join(RAW, 'canon', 'book_tags.csv'), 'utf8').split('\n');
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i]; if (!l) continue;
    const p = l.split(',');
    if (p.length !== 3) continue;
    const c = +p[2];
    if (!(c > 0)) continue;                              // negatif/sifir sayaclari at
    const id = grToId.get(+p[0]); if (!id) continue;
    const name = tagName.get(+p[1]); if (!name || isNoise(name)) continue;
    let arr = bookTagRaw.get(id);
    if (!arr) bookTagRaw.set(id, (arr = []));
    arr.push([name, c]);
  }
}

const topTags = new Array(N + 1);
for (let id = 1; id <= N; id++) {
  const arr = bookTagRaw.get(id) || [];
  arr.sort((a, b) => b[1] - a[1]);
  const max = arr.length ? arr[0][1] : 1;
  topTags[id] = arr.slice(0, 12).map(([name]) => name);
  for (const [name, c] of arr.slice(0, 120)) {
    const w = c / max;
    const hit = exactMap.get(name);
    if (hit) for (const fi of hit) facetRaw[id * F + fi] += w;
    for (let fi = 0; fi < F; fi++) {
      const re = FACETS[fi].re;
      if (re && !(hit && hit.includes(fi)) && re.test(name)) facetRaw[id * F + fi] += w * 0.5;
    }
  }
  for (const gi of books[id].genres) {
    const g = genreList[gi];
    for (let fi = 0; fi < F; fi++) if (FACETS[fi].genres.includes(g)) facetRaw[id * F + fi] += 0.7;
  }
}
const facetBytes = new Uint8Array(N * F);
for (let id = 1; id <= N; id++) {
  for (let fi = 0; fi < F; fi++) {
    const s = facetRaw[id * F + fi];
    facetBytes[(id - 1) * F + fi] = Math.round(255 * (s / (s + 0.8)));   // doyuma giden normalizasyon
  }
}
log('boyut puanlari hazir');

// ---------------------------------------------------------------- benzerlik
log('puanlar okunuyor...');
const lines = readFileSync(join(RAW, 'canon', 'ratings.csv'), 'utf8').split('\n');
const users = new Map();       // userId -> [bookId...]
const likeCount = new Int32Array(N + 1);
let liked = 0;
for (let i = 1; i < lines.length; i++) {
  const l = lines[i]; if (!l) continue;
  const c1 = l.indexOf(','), c2 = l.indexOf(',', c1 + 1);
  if (c1 < 0 || c2 < 0) continue;
  if (+l.slice(c2 + 1) < LIKE_MIN) continue;
  const u = +l.slice(0, c1), b = +l.slice(c1 + 1, c2);
  if (!(b >= 1 && b <= N)) continue;
  let arr = users.get(u);
  if (!arr) users.set(u, (arr = []));
  if (arr.length < MAX_PER_USER) { arr.push(b); likeCount[b]++; liked++; }
}
log(`${liked.toLocaleString('tr')} begeni (>=${LIKE_MIN} yildiz), ${users.size.toLocaleString('tr')} okur`);

log('ortak okuma matrisi (200 MB ayriliyor)...');
const co = new Uint16Array(N * N);
let pairs = 0;
for (const arr of users.values()) {
  const n = arr.length;
  if (n < 2) continue;
  for (let a = 0; a < n; a++) {
    const ia = (arr[a] - 1) * N;
    for (let b = a + 1; b < n; b++) {
      const jb = arr[b] - 1;
      if (co[ia + jb] < 65535) co[ia + jb]++;
      const ib = jb * N + arr[a] - 1;
      if (co[ib] < 65535) co[ib]++;
    }
  }
  pairs += (n * (n - 1)) / 2;
}
log(`${pairs.toLocaleString('tr')} kitap cifti sayildi`);

log('benzerlik siralaniyor...');
const simIds = new Uint16Array(N * K);
const simScore = new Uint8Array(N * K);
const pop = new Float64Array(N + 1);
for (let i = 1; i <= N; i++) pop[i] = Math.pow(Math.max(likeCount[i], 1), POP_DAMP);

const bestId = new Int32Array(K), bestVal = new Float64Array(K);
for (let i = 1; i <= N; i++) {
  bestId.fill(0); bestVal.fill(0);
  const base = (i - 1) * N, pi = pop[i];
  for (let j = 1; j <= N; j++) {
    if (j === i) continue;
    const c = co[base + j - 1];
    if (c < MIN_CO) continue;
    const s = (c / (pi * pop[j])) * (c / (c + SHRINK));
    let p = K - 1;
    if (s <= bestVal[p]) continue;
    while (p > 0 && bestVal[p - 1] < s) { bestVal[p] = bestVal[p - 1]; bestId[p] = bestId[p - 1]; p--; }
    bestVal[p] = s; bestId[p] = j;
  }
  const max = bestVal[0] || 1;
  for (let k = 0; k < K; k++) {
    simIds[(i - 1) * K + k] = bestId[k];
    simScore[(i - 1) * K + k] = bestId[k] ? Math.max(1, Math.round(255 * (bestVal[k] / max))) : 0;
  }
}
log('benzerlik hazir');

// ---------------------------------------------------------------- yazma
const header = Buffer.alloc(16);
header.write('BRSM', 0, 'ascii');
header.writeUInt32LE(1, 4); header.writeUInt32LE(N, 8); header.writeUInt32LE(K, 12);
writeFileSync(join(OUT, 'sim.bin'), Buffer.concat([header, Buffer.from(simIds.buffer), Buffer.from(simScore.buffer)]));
writeFileSync(join(OUT, 'facets.bin'), Buffer.from(facetBytes.buffer));

const compact = [];
for (let i = 1; i <= N; i++) {
  const b = books[i];
  compact.push([b.id, b.gr, b.title, b.authors, b.year, b.pages, b.avg, b.count, b.genres, b.series, b.seriesNo, likeCount[i], topTags[i]]);
}
writeFileSync(join(OUT, 'books.json'), JSON.stringify({
  fields: ['id', 'gr', 'title', 'authors', 'year', 'pages', 'avg', 'count', 'genres', 'series', 'seriesNo', 'likes', 'tags'],
  genres: genreList, books: compact,
}));

const SHARD = 500;
for (let s = 0; s * SHARD < N; s++) {
  const obj = {};
  for (let id = s * SHARD + 1; id <= Math.min((s + 1) * SHARD, N); id++) {
    const d = descriptions.get(id); if (d) obj[id] = d;
  }
  writeFileSync(join(OUT, 'desc', `${s}.json`), JSON.stringify(obj));
}

writeFileSync(join(OUT, 'facets.json'), JSON.stringify({
  facets: FACETS.map((f) => ({ id: f.id, label: f.label })),
  descShard: SHARD, simK: K, bookCount: N,
}));

const checksums = JSON.parse(readFileSync(join(RAW, 'checksums.json'), 'utf8'));
writeFileSync(join(OUT, 'meta.json'), JSON.stringify({
  builtAt: new Date().toISOString(),
  books: N, ratings: liked, readers: users.size, neighborsPerBook: K,
  sources: [
    { name: 'goodbooks-10k', url: 'https://github.com/zygmuntz/goodbooks-10k', license: 'CC BY-SA 4.0' },
    { name: 'goodbooks-10k-extended (aciklama/tur alanlari)', url: 'https://github.com/malcolmosh/goodbooks-10k-extended', license: 'CC BY-SA 4.0' },
  ],
  rawChecksums: checksums.map(({ rel, sha256 }) => ({ rel, sha256 })),
}, null, 2));

log('yazildi -> public/data/');
