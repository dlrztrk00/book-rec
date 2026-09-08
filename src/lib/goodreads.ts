// Goodreads "Export Library" CSV dosyasini okur ve veri setiyle eslestirir.
import type { Dataset } from './dataset';

export type Shelf = 'read' | 'to-read' | 'currently-reading' | 'other';

export type LibraryEntry = {
  bookId: number;          // veri setindeki id
  myRating: number;        // 0 = puanlamamis
  shelf: Shelf;
  dateRead: string;
  matchedBy: 'id' | 'title+author' | 'title';
};

export type ImportResult = {
  entries: LibraryEntry[];
  totalRows: number;
  unmatched: { title: string; author: string; shelf: Shelf }[];
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', q = false, i = 0;
  if (text.charCodeAt(0) === 0xfeff) i = 1;
  for (; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const stripAccents = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[ıİ]/g, 'i').replace(/[şŞ]/g, 's').replace(/[ğĞ]/g, 'g')
    .replace(/[çÇ]/g, 'c').replace(/[öÖ]/g, 'o').replace(/[üÜ]/g, 'u');

export const normTitle = (s: string) =>
  stripAccents(String(s || '').toLowerCase())
    .replace(/\([^)]*\)/g, ' ')          // (Seri, #2)
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^(the|a|an) /, '')
    .trim();

const normAuthor = (s: string) => {
  const parts = stripAccents(String(s || '').toLowerCase()).replace(/[^a-z ]+/g, ' ').trim().split(/\s+/);
  return parts.length ? parts[parts.length - 1] : '';   // soyad
};

const shelfOf = (s: string): Shelf => {
  const v = String(s || '').trim().toLowerCase();
  if (v === 'read' || v === 'to-read' || v === 'currently-reading') return v;
  return 'other';
};

export function importGoodreadsCsv(text: string, ds: Dataset): ImportResult {
  const rows = parseCsv(text);
  if (!rows.length) return { entries: [], totalRows: 0, unmatched: [] };
  const header = rows[0].map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);

  const cId = col('Book Id'), cTitle = col('Title'), cAuthor = col('Author');
  const cRating = col('My Rating'), cShelf = col('Exclusive Shelf'), cDate = col('Date Read');
  if (cTitle < 0) throw new Error('Bu bir Goodreads kütüphane dışa aktarımı değil: "Title" sütunu yok.');

  // baslik dizinleri (tembel kurulum)
  const byTitleAuthor = new Map<string, number>();
  const byTitle = new Map<string, number | null>();   // null = birden fazla aday
  for (const b of ds.all) {
    const t = normTitle(b.title);
    if (!t) continue;
    for (const a of b.authors) {
      const key = `${t}|${normAuthor(a)}`;
      if (!byTitleAuthor.has(key)) byTitleAuthor.set(key, b.id);
    }
    byTitle.set(t, byTitle.has(t) ? null : b.id);
  }

  const entries: LibraryEntry[] = [];
  const unmatched: ImportResult['unmatched'] = [];
  const seen = new Set<number>();
  let totalRows = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 2 || !r[cTitle]) continue;
    totalRows++;

    const title = r[cTitle], author = cAuthor >= 0 ? r[cAuthor] : '';
    const shelf = cShelf >= 0 ? shelfOf(r[cShelf]) : 'other';
    const myRating = cRating >= 0 ? Math.max(0, Math.min(5, Math.round(+r[cRating] || 0))) : 0;
    const dateRead = cDate >= 0 ? (r[cDate] || '') : '';

    let bookId = 0;
    let matchedBy: LibraryEntry['matchedBy'] = 'id';
    const grId = cId >= 0 ? +r[cId] : 0;
    if (grId && ds.byGoodreadsId.has(grId)) bookId = ds.byGoodreadsId.get(grId)!;
    if (!bookId) {
      const t = normTitle(title);
      const ta = byTitleAuthor.get(`${t}|${normAuthor(author)}`);
      if (ta) { bookId = ta; matchedBy = 'title+author'; }
      else {
        const only = byTitle.get(t);
        if (only) { bookId = only; matchedBy = 'title'; }
      }
    }

    if (!bookId) { unmatched.push({ title, author, shelf }); continue; }
    if (seen.has(bookId)) continue;
    seen.add(bookId);
    entries.push({ bookId, myRating, shelf, dateRead, matchedBy });
  }

  return { entries, totalRows, unmatched };
}
