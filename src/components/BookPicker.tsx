import { useMemo, useState } from 'react';
import type { Book, Dataset } from '../lib/dataset';
import { normTitle } from '../lib/goodreads';

export function BookPicker({ ds, value, max, onChange }: {
  ds: Dataset; value: number[]; max: number; onChange: (ids: number[]) => void;
}) {
  const [q, setQ] = useState('');

  const index = useMemo(
    () => ds.all.map((b) => ({ b, t: normTitle(b.title), a: b.authors.join(' ').toLowerCase() })),
    [ds],
  );

  const results = useMemo(() => {
    const needle = normTitle(q);
    if (needle.length < 2) return [] as Book[];
    const starts: Book[] = [], contains: Book[] = [];
    for (const it of index) {
      if (it.t.startsWith(needle)) starts.push(it.b);
      else if (it.t.includes(needle) || it.a.includes(q.toLowerCase())) contains.push(it.b);
      if (starts.length >= 8) break;
    }
    return [...starts, ...contains]
      .filter((b) => !value.includes(b.id))
      .sort((x, y) => y.count - x.count)
      .slice(0, 7);
  }, [q, index, value]);

  const full = value.length >= max;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {value.map((id) => {
          const b = ds.books[id];
          if (!b) return null;
          return (
            <button key={id} onClick={() => onChange(value.filter((v) => v !== id))}
              className="group flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 py-1.5 pl-3 pr-2 text-left text-sm">
              <span className="max-w-[240px] truncate">{b.title}</span>
              <span className="text-paper/40 group-hover:text-accent">×</span>
            </button>
          );
        })}
      </div>

      {!full && (
        <div className="relative">
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Kitap adı yaz..."
            className="w-full rounded-lg border border-paper/15 bg-ink-2 px-4 py-3 text-paper
                       outline-none placeholder:text-paper/30 focus:border-accent/60" />
          {results.length > 0 && (
            <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-lg border border-paper/15 bg-ink-2 shadow-2xl shadow-black/60">
              {results.map((b) => (
                <li key={b.id}>
                  <button onClick={() => { onChange([...value, b.id]); setQ(''); }}
                    className="block w-full px-4 py-2.5 text-left hover:bg-paper/8">
                    <div className="truncate text-sm">{b.title}</div>
                    <div className="truncate text-xs text-paper/45">{b.authors.join(', ')}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
