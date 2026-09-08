// Open Library istemcisi (CC0 veri, anahtar gerektirmez).
// Veri setinin bittigi 2017'den sonraki kitaplari canli olarak getirir.
import type { Book, Dataset } from './dataset.ts';

export const FRESH_ID_BASE = 1_000_000;
export const FRESH_FROM_YEAR = 2017;

export type FreshBook = Book & { workKey: string; subjects: string[]; isNew: true };

const API = 'https://openlibrary.org';
const FIELDS = [
  'key', 'title', 'author_name', 'first_publish_year', 'subject',
  'readinglog_count', 'ratings_count', 'ratings_average',
  'number_of_pages_median', 'language',
].join(',');

// Boyutlarimizi Open Library konu terimlerine baglar.
const OL_SUBJECTS: Record<string, string[]> = {
  dark: ['horror', 'gothic fiction'],
  light: ['humorous fiction', 'romantic comedy'],
  emotional: ['domestic fiction'],
  hopeful: ['inspirational fiction'],
  fast: ['thrillers', 'suspense'],
  slow: ['literary fiction'],
  twisty: ['mystery', 'psychological fiction'],
  romance: ['romance', 'love stories'],
  steamy: ['erotic fiction'],
  fantasy: ['fantasy', 'epic fantasy'],
  scifi: ['science fiction', 'dystopian fiction'],
  supernatural: ['paranormal fiction', 'vampires'],
  realistic: ['contemporary fiction'],
  historical: ['historical fiction'],
  literary: ['literary fiction'],
  truestory: ['biography', 'memoirs'],
  ideas: ['psychology', 'philosophy', 'popular science'],
  comingofage: ['young adult fiction', 'coming of age'],
  family: ['family life fiction'],
  social: ['social problems', 'feminism'],
  strange: ['magic realism', 'speculative fiction'],
  adventure: ['adventure fiction', 'survival'],
  crime: ['detective and mystery stories', 'crime fiction'],
  shortform: ['short stories'],
  comics: ['comics and graphic novels'],
  faith: ['religious fiction', 'spirituality'],
};

// ---------------------------------------------------------------- onbellek
const CACHE_PREFIX = 'book-rec:ol:v1:';
const TTL = 7 * 24 * 3600 * 1000;

const cacheGet = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || Date.now() - v.t > TTL) return null;
    return v.d as T;
  } catch { return null; }
};

const cacheSet = (key: string, d: unknown) => {
  try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), d })); }
  catch { pruneCache(); }
};

function pruneCache() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    keys.slice(0, Math.ceil(keys.length / 2)).forEach((k) => localStorage.removeItem(k));
  } catch { /* yoksay */ }
}

export function clearFreshCache() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch { /* yoksay */ }
}

// ---------------------------------------------------------------- getirme
const TIMEOUT = 20000;

async function getJson(url: string): Promise<any | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// Open Library kayitlarinda cok gurultu var; kalite esigi.
function acceptable(d: any): boolean {
  if (!d?.key || !d?.title) return false;
  const year = d.first_publish_year;
  if (!year || year < FRESH_FROM_YEAR || year > new Date().getFullYear() + 1) return false;
  if (!(d.author_name?.length)) return false;
  if (!(d.language ?? []).includes('eng')) return false;
  const subjects: string[] = d.subject ?? [];
  if (subjects.length < 5) return false;                   // spam kayitlarin konusu 1-2 olur
  const reads = d.readinglog_count ?? 0;
  const rc = d.ratings_count ?? 0;
  if (reads < 40 && rc < 12) return false;
  if (rc >= 10 && (d.ratings_average ?? 0) < 3.4) return false;
  return true;
}

function toFresh(d: any, id: number): FreshBook {
  const subjects: string[] = (d.subject ?? []).slice(0, 60);
  return {
    id,
    gr: 0,
    title: String(d.title).slice(0, 160),
    authors: (d.author_name ?? []).slice(0, 3),
    year: d.first_publish_year ?? 0,
    pages: Math.round(d.number_of_pages_median ?? 0) || 0,
    avg: d.ratings_average ?? 0,
    count: d.ratings_count ?? 0,
    genres: [],
    series: '',
    seriesNo: 0,
    likes: d.readinglog_count ?? 0,
    tags: subjects.slice(0, 12).map((s) => s.toLowerCase()),
    workKey: d.key,
    subjects,
    isNew: true,
  };
}

async function searchSubject(subject: string, limit: number): Promise<any[]> {
  const key = `s:${subject}:${limit}`;
  const hit = cacheGet<any[]>(key);
  if (hit) return hit;
  const q = `subject:"${subject}" first_publish_year:[${FRESH_FROM_YEAR} TO 2100]`;
  const url = `${API}/search.json?q=${encodeURIComponent(q)}&sort=readinglog&limit=${limit}&fields=${FIELDS}`;
  const d = await getJson(url);
  const docs = (d?.docs ?? []).filter(acceptable);
  if (d) cacheSet(key, docs);
  return docs;
}

/**
 * Tercihlere gore Open Library'den 2017 sonrasi kitap adaylari getirir.
 * Ag hatasi sessizce bos dizi dondurur; site cevrimdisi de calisir.
 */
export async function fetchFresh(
  ds: Dataset,
  topFacets: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<FreshBook[]> {
  const terms = new Set<string>();
  for (const f of topFacets.slice(0, 4)) for (const s of OL_SUBJECTS[f] ?? []) terms.add(s);
  // profil bos olsa bile genel bir taban getir
  ['fiction', 'literary fiction'].forEach((t) => terms.add(t));

  const list = [...terms].slice(0, 8);
  let done = 0;
  const batches: any[][] = new Array(list.length);
  const CONCURRENCY = 3;
  let next = 0;

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, async () => {
    while (next < list.length) {
      const i = next++;
      batches[i] = await searchSubject(list[i], 60);
      onProgress?.(++done, list.length);
    }
  }));

  // ayni kitabi elemek icin yerel havuzdaki basliklari topla
  const localTitles = new Set<string>();
  for (const b of ds.all) localTitles.add(normKey(b.title, b.authors[0] ?? ''));

  const seen = new Set<string>();
  const out: FreshBook[] = [];
  let id = FRESH_ID_BASE;
  for (const docs of batches) {
    for (const d of docs ?? []) {
      const k = normKey(d.title, (d.author_name ?? [''])[0]);
      if (seen.has(k) || localTitles.has(k)) continue;
      seen.add(k);
      out.push(toFresh(d, id++));
    }
  }
  return out;
}

const normKey = (title: string, author: string) =>
  `${String(title).toLowerCase().replace(/[^a-z0-9]+/g, '')}|` +
  `${String(author).toLowerCase().replace(/[^a-z]+/g, '').slice(-12)}`;

export async function fetchFreshDescription(workKey: string): Promise<string | null> {
  const key = `d:${workKey}`;
  const hit = cacheGet<string>(key);
  if (hit !== null) return hit;
  const d = await getJson(`${API}${workKey}.json`);
  if (d === null) return null;        // ag hatasi: onbellege YAZMA, sonra tekrar denensin
  let desc = d.description;
  if (desc && typeof desc === 'object') desc = desc.value;
  const text = typeof desc === 'string'
    ? desc.replace(/<[^>]{0,200}>/g, ' ')
        .replace(/https?:\/\/\S+/gi, ' ')
        .replace(/\(\[source\]\[\d+\]\)/gi, ' ')
        .replace(/-{3,}[\s\S]*$/, '')
        .replace(/\s+/g, ' ').trim().slice(0, 2600)
    : '';
  cacheSet(key, text);                // gercekten ozeti olmayan kitap da onbelleklenir
  return text || null;
}
