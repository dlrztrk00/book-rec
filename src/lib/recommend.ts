import type { Book, Dataset } from './dataset';
import type { LibraryEntry } from './goodreads';
import type { FreshBook } from './openlibrary';
import type { Prefs } from './questions';

export type SeedReason = { book: Book; weight: number };

export type Recommendation = {
  book: Book;
  isNew: boolean;
  match: number;                       // 0-100
  parts: { taste: number; prefs: number; quality: number; discovery: number };
  seeds: SeedReason[];                 // "sunlari sevdigin icin"
  matched: string[];                   // uyan boyut etiketleri
  missed: string[];                    // istenip bulunamayan boyutlar
  inToRead: boolean;
  seriesNote: string | null;
};

const WEIGHTS = {
  safe:    { taste: .58, prefs: .26, quality: .10, discovery: .06 },
  stretch: { taste: .44, prefs: .38, quality: .10, discovery: .08 },
  wild:    { taste: .25, prefs: .53, quality: .10, discovery: .12 },
};

const seedWeight = (e: LibraryEntry): number => {
  if (e.myRating === 5) return 1;
  if (e.myRating === 4) return .55;
  if (e.myRating === 3) return .05;
  if (e.myRating === 2) return -.45;
  if (e.myRating === 1) return -.8;
  return e.shelf === 'read' ? .22 : 0;      // puanlanmamis ama okunmus
};

const normalize = (m: Map<number, number>) => {
  let lo = Infinity, hi = -Infinity;
  for (const v of m.values()) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const span = hi - lo;
  return (v: number) => (span > 1e-9 ? (v - lo) / span : 0.5);
};

/** Kullanicinin sevdigi kitaplarin etiketlerinden bir "konu profili" cikarir.
 *  Yeni kitaplarda ortak-okur verisi olmadigi icin koprü bu profil uzerinden kurulur. */
function tasteProfile(ds: Dataset, library: LibraryEntry[]): Map<string, number> {
  const p = new Map<string, number>();
  for (const e of library) {
    const w = e.myRating === 5 ? 1 : e.myRating === 4 ? 0.55 : 0;
    if (!w) continue;
    const b = ds.books[e.bookId];
    if (!b) continue;
    b.tags.forEach((t, i) => {
      const k = t.toLowerCase();
      p.set(k, (p.get(k) ?? 0) + (w / (1 + i / 6)));
    });
  }
  let norm = 0;
  for (const v of p.values()) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  for (const [k, v] of p) p.set(k, v / norm);
  return p;
}

function bridgeScore(profile: Map<string, number>, tags: string[]): number {
  if (!profile.size || !tags.length) return 0;
  let dot = 0, norm = 0;
  tags.forEach((t, i) => {
    const w = 1 / (1 + i / 6);
    norm += w * w;
    const pv = profile.get(t.toLowerCase().trim());
    if (pv) dot += pv * w;
  });
  return norm ? dot / Math.sqrt(norm) : 0;
}

export function recommend(
  ds: Dataset,
  library: LibraryEntry[],
  prefs: Prefs,
  limit = 12,
  fresh: FreshBook[] = [],
): Recommendation[] {
  const facetIndex = new Map(ds.facets.map((f, i) => [f.id, i]));
  const F = ds.facets.length;

  // ---- istenen boyut vektoru
  const desire = new Float32Array(F);
  for (const [id, v] of Object.entries(prefs.facetWeights)) {
    const i = facetIndex.get(id);
    if (i !== undefined) desire[i] = v;
  }
  let posSum = 0, negSum = 0;
  for (let i = 0; i < F; i++) { if (desire[i] > 0) posSum += desire[i]; else negSum += -desire[i]; }

  // ---- kutuphane durumu
  const owned = new Map<number, LibraryEntry>();
  for (const e of library) owned.set(e.bookId, e);
  const readSeries = new Map<string, number>();       // seri -> okunan en yuksek numara
  for (const e of library) {
    if (e.shelf !== 'read') continue;
    const b = ds.books[e.bookId];
    if (b?.series) readSeries.set(b.series, Math.max(readSeries.get(b.series) ?? 0, b.seriesNo));
  }

  // ---- tohumlar
  const seeds: { id: number; w: number }[] = [];
  for (const e of library) {
    const w = seedWeight(e);
    if (w !== 0) seeds.push({ id: e.bookId, w });
  }
  for (const id of prefs.likeBooks) seeds.push({ id, w: 1.4 });

  const posCount = seeds.filter((s) => s.w > 0).length;
  const scale = posCount ? 1 / Math.sqrt(posCount) : 0;

  // ---- ortak okur sinyali
  const taste = new Map<number, number>();
  const penalty = new Map<number, number>();
  const contrib = new Map<number, { id: number; v: number }[]>();

  for (const s of seeds) {
    for (const n of ds.neighbors(s.id)) {
      if (owned.has(n.id) && owned.get(n.id)!.shelf !== 'to-read') continue;
      if (s.w > 0) {
        const v = s.w * n.score * scale;
        taste.set(n.id, (taste.get(n.id) ?? 0) + v);
        let c = contrib.get(n.id);
        if (!c) contrib.set(n.id, (c = []));
        c.push({ id: s.id, v });
      } else {
        penalty.set(n.id, (penalty.get(n.id) ?? 0) + -s.w * n.score * scale);
      }
    }
  }
  for (const [id, p] of penalty) taste.set(id, (taste.get(id) ?? 0) - 0.8 * p);

  // ---- aday havuzu
  const avoidIdx = prefs.avoid.map((a) => facetIndex.get(a)).filter((i): i is number => i !== undefined);
  const pool: Book[] = [];
  const source: Iterable<Book> = taste.size >= 40
    ? [...taste.keys()].map((id) => ds.books[id]).filter(Boolean)
    : ds.all;

  for (const b of source) {
    const own = owned.get(b.id);
    if (own && own.shelf !== 'to-read') continue;
    if (b.count < 500) continue;                                  // cok az veriye guvenme
    if (prefs.kind !== 'either') {
      const isFiction = b.genres.includes('fiction');
      if (prefs.kind === 'fiction' && !isFiction) continue;
      if (prefs.kind === 'nonfiction' && isFiction) continue;
    }
    if (avoidIdx.some((i) => ds.facetValue(b.id, i) > 0.55)) continue;
    if (prefs.pages && b.pages > 0 && (b.pages < prefs.pages[0] || b.pages > prefs.pages[1])) continue;
    if (prefs.year && b.year > 0 && (b.year < prefs.year[0] || b.year > prefs.year[1])) continue;
    if (prefs.series === 'standalone' && b.seriesNo > 0) continue;
    if (prefs.series === 'first' && b.seriesNo > 1) continue;
    pool.push(b);
  }
  // ---- Open Library'den gelen 2017 sonrasi adaylar (ortak okur verisi yok)
  const freshFacets = new Map<number, Float32Array>();
  const freshBridge = new Map<number, number>();
  const profile = tasteProfile(ds, library);
  const rawBridge: number[] = [];

  for (const fb of prefs.freshness === 'classics' ? [] : fresh) {
    const v = ds.facetsFromSubjects(fb.subjects);
    if (avoidIdx.some((i) => v[i] > 0.55)) continue;
    if (prefs.pages && fb.pages > 0 && (fb.pages < prefs.pages[0] || fb.pages > prefs.pages[1])) continue;
    if (prefs.year && fb.year > 0 && (fb.year < prefs.year[0] || fb.year > prefs.year[1])) continue;
    if (prefs.kind !== 'either') {
      const nf = v[facetIndex.get('truestory') ?? -1] ?? 0;
      if (prefs.kind === 'nonfiction' && nf < 0.35) continue;
      if (prefs.kind === 'fiction' && nf > 0.6) continue;
    }
    freshFacets.set(fb.id, v);
    const bs = bridgeScore(profile, fb.tags);
    freshBridge.set(fb.id, bs);
    rawBridge.push(bs);
    pool.push(fb);
  }

  const facetsOf = (b: Book): Float32Array => freshFacets.get(b.id) ?? ds.facetVector(b.id);
  const isFresh = (b: Book) => freshFacets.has(b.id);

  if (!pool.length) return [];

  // ---- bilesenler
  const rawPrefs = new Map<number, number>();
  const rawDisc = new Map<number, number>();
  const rawQual = new Map<number, number>();
  const qualLocal = new Map<number, number>(), qualFresh = new Map<number, number>();
  const discLocal = new Map<number, number>(), discFresh = new Map<number, number>();
  const maxLog = Math.log10(26000);

  for (const b of pool) {
    const v = facetsOf(b);
    let pos = 0, neg = 0;
    for (let i = 0; i < F; i++) {
      if (desire[i] > 0) pos += desire[i] * v[i];
      else if (desire[i] < 0) neg += -desire[i] * v[i];
    }
    const p = (posSum ? pos / posSum : 0.5) - (negSum ? (neg / negSum) * 0.9 : 0);
    rawPrefs.set(b.id, p);

    // Goodreads ve Open Library'nin oy hacimleri ~100 kat farkli. Ayni Bayes
    // kaydirmasi yeni kitaplari sistematik olarak eziyor; her kaynak kendi
    // olcegi icinde degerlendirilip ayri normalize edilir.
    const fresh = isFresh(b);
    const lp = Math.min(1, Math.log10(b.likes + 1) / (fresh ? Math.log10(15000) : maxLog));
    const disc = prefs.popularity === 'popular' ? lp
      : prefs.popularity === 'hidden' ? 1 - lp
      : 1 - Math.abs(lp - 0.55) * 0.8;

    const m = fresh ? 25 : 800;                                    // kaynagin oy hacmine gore
    const qual = (b.avg * b.count + (fresh ? 3.85 : 3.9) * m) / (b.count + m);

    rawDisc.set(b.id, disc);
    rawQual.set(b.id, qual);
    (fresh ? qualFresh : qualLocal).set(b.id, qual);
    (fresh ? discFresh : discLocal).set(b.id, disc);
  }

  const bridgeNorm = (() => {
    if (!rawBridge.length) return () => 0;
    const hi = Math.max(...rawBridge), lo = Math.min(...rawBridge);
    const span = hi - lo;
    return (v: number) => (span > 1e-9 ? (v - lo) / span : 0.5);
  })();
  const nTaste = normalize(taste);
  const nPrefs = normalize(rawPrefs);
  const nQualLocal = normalize(qualLocal), nQualFresh = normalize(qualFresh);
  const nDiscLocal = normalize(discLocal), nDiscFresh = normalize(discFresh);
  const W = WEIGHTS[prefs.novelty];
  const hasTaste = posCount > 0 && taste.size > 0;
  const w = hasTaste ? W : { taste: 0, prefs: W.prefs + W.taste, quality: W.quality, discovery: W.discovery };

  type Scored = { b: Book; total: number; parts: Recommendation['parts']; seriesNote: string | null };
  const scored: Scored[] = [];

  for (const b of pool) {
    const parts = {
      // Yeni kitaplarda ortak-okur sinyali yok: konu koprüsü kullanilir ve
      // daha zayif bir kanit oldugu icin bir miktar kisilir.
      taste: isFresh(b)
        ? (profile.size ? bridgeNorm(freshBridge.get(b.id) ?? 0) * 0.85 : 0)
        : hasTaste ? nTaste(taste.get(b.id) ?? 0) : 0,
      prefs: nPrefs(rawPrefs.get(b.id) ?? 0),
      quality: (isFresh(b) ? nQualFresh : nQualLocal)(rawQual.get(b.id) ?? 0),
      discovery: (isFresh(b) ? nDiscFresh : nDiscLocal)(rawDisc.get(b.id) ?? 0),
    };
    let total = parts.taste * w.taste + parts.prefs * w.prefs
              + parts.quality * w.quality + parts.discovery * w.discovery;

    // seri farkindaligi: okunmamis onceki kitaplar varsa geri cek
    let seriesNote: string | null = null;
    if (b.series && b.seriesNo > 1) {
      const readUpTo = readSeries.get(b.series) ?? 0;
      if (readUpTo < b.seriesNo - 1) {
        total *= 0.55;
        seriesNote = `${b.series} serisinin ${b.seriesNo}. kitabı — önce öncekiler`;
      } else {
        seriesNote = `${b.series} serisinde sıradaki kitap`;
      }
    }
    scored.push({ b, total, parts, seriesNote });
  }

  scored.sort((x, y) => y.total - x.total);

  // ---- secim: yazar basina en fazla 2, seri basina 1, artı yeni kitap kotasi.
  // Yeni kitaplarin arkasinda ortak okur kaniti olmadigi icin ham puanda
  // yerel klasiklere karsi hep geride kalirlar; kullanici yeni istediyse
  // liste icinde kendilerine ayrilmis yer verilir.
  const perAuthor = new Map<string, number>();
  const usedSeries = new Set<string>();
  const eligible = (b: Book) => {
    const a = b.authors[0] ?? '?';
    if ((perAuthor.get(a) ?? 0) >= 2) return false;
    if (b.series && usedSeries.has(b.series)) return false;
    return true;
  };
  const take = (b: Book) => {
    const a = b.authors[0] ?? '?';
    perAuthor.set(a, (perAuthor.get(a) ?? 0) + 1);
    if (b.series) usedSeries.add(b.series);
  };

  const freshQuota = prefs.freshness === 'new' ? Math.ceil(limit * 0.6)
    : prefs.freshness === 'balanced' ? Math.floor(limit * 0.25) : 0;

  const picked = new Set<number>();
  if (freshQuota > 0) {
    let n = 0;
    for (const s of scored) {
      if (n >= freshQuota) break;
      if (!isFresh(s.b) || !eligible(s.b)) continue;
      take(s.b); picked.add(s.b.id); n++;
    }
  }
  for (const s of scored) {
    if (picked.size >= limit) break;
    if (picked.has(s.b.id) || !eligible(s.b)) continue;
    take(s.b); picked.add(s.b.id);
  }

  const out: Recommendation[] = [];
  for (const s of scored) {
    if (!picked.has(s.b.id)) continue;

    const v = facetsOf(s.b);
    const wanted = ds.facets
      .map((f, i) => ({ label: f.label, d: desire[i], v: v[i] }))
      .filter((x) => x.d > 0.15);
    const matched = wanted.filter((x) => x.v > 0.45).sort((p, q) => q.v * q.d - p.v * p.d).slice(0, 4).map((x) => x.label);
    const missed = wanted.filter((x) => x.d > 0.45 && x.v < 0.18)
      .sort((p, q) => q.d - p.d).slice(0, 2).map((x) => x.label);

    const seeds = (contrib.get(s.b.id) ?? [])
      .sort((p, q) => q.v - p.v).slice(0, 3)
      .map((c) => ({ book: ds.books[c.id], weight: c.v }))
      .filter((x) => x.book);

    out.push({
      book: s.b,
      isNew: isFresh(s.b),
      match: Math.round(s.total * 100),
      parts: s.parts,
      seeds,
      matched,
      missed,
      inToRead: owned.get(s.b.id)?.shelf === 'to-read',
      seriesNote: s.seriesNote,
    });
  }
  return out;
}
