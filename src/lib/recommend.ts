import type { Book, Dataset } from './dataset';
import type { LibraryEntry } from './goodreads';
import type { Prefs } from './questions';

export type SeedReason = { book: Book; weight: number };

export type Recommendation = {
  book: Book;
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

export function recommend(
  ds: Dataset,
  library: LibraryEntry[],
  prefs: Prefs,
  limit = 12,
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
  if (!pool.length) return [];

  // ---- bilesenler
  const rawPrefs = new Map<number, number>();
  const rawDisc = new Map<number, number>();
  const rawQual = new Map<number, number>();
  const maxLog = Math.log10(26000);

  for (const b of pool) {
    const v = ds.facetVector(b.id);
    let pos = 0, neg = 0;
    for (let i = 0; i < F; i++) {
      if (desire[i] > 0) pos += desire[i] * v[i];
      else if (desire[i] < 0) neg += -desire[i] * v[i];
    }
    const p = (posSum ? pos / posSum : 0.5) - (negSum ? (neg / negSum) * 0.9 : 0);
    rawPrefs.set(b.id, p);

    const lp = Math.min(1, Math.log10(b.likes + 1) / maxLog);
    rawDisc.set(b.id,
      prefs.popularity === 'popular' ? lp
      : prefs.popularity === 'hidden' ? 1 - lp
      : 1 - Math.abs(lp - 0.55) * 0.8);

    const m = 800;                                                 // Bayes kaydirmasi
    rawQual.set(b.id, (b.avg * b.count + 3.9 * m) / (b.count + m));
  }

  const nTaste = normalize(taste);
  const nPrefs = normalize(rawPrefs);
  const nDisc = normalize(rawDisc);
  const nQual = normalize(rawQual);
  const W = WEIGHTS[prefs.novelty];
  const hasTaste = posCount > 0 && taste.size > 0;
  const w = hasTaste ? W : { taste: 0, prefs: W.prefs + W.taste, quality: W.quality, discovery: W.discovery };

  type Scored = { b: Book; total: number; parts: Recommendation['parts']; seriesNote: string | null };
  const scored: Scored[] = [];

  for (const b of pool) {
    const parts = {
      taste: hasTaste ? nTaste(taste.get(b.id) ?? 0) : 0,
      prefs: nPrefs(rawPrefs.get(b.id) ?? 0),
      quality: nQual(rawQual.get(b.id) ?? 0),
      discovery: nDisc(rawDisc.get(b.id) ?? 0),
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

  // ---- cesitlilik: yazar basina en fazla 2, seri basina 1
  const out: Recommendation[] = [];
  const perAuthor = new Map<string, number>();
  const usedSeries = new Set<string>();

  for (const s of scored) {
    if (out.length >= limit) break;
    const a = s.b.authors[0] ?? '?';
    if ((perAuthor.get(a) ?? 0) >= 2) continue;
    if (s.b.series && usedSeries.has(s.b.series)) continue;
    perAuthor.set(a, (perAuthor.get(a) ?? 0) + 1);
    if (s.b.series) usedSeries.add(s.b.series);

    const v = ds.facetVector(s.b.id);
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
