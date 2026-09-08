import type { LibraryEntry } from './goodreads';
import type { Answers } from './questions';

const KEY = 'book-rec:v1';

export type Saved = {
  library: LibraryEntry[];
  answers: Answers;
  step: 'import' | 'survey' | 'results';
  importStats?: { total: number; matched: number; rated: number };
};

export function load(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object' || !Array.isArray(v.library)) return null;
    return v as Saved;
  } catch { return null; }
}

export function save(s: Saved) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* kota dolu olabilir */ }
}

export function clear() {
  try { localStorage.removeItem(KEY); } catch { /* yoksay */ }
}
