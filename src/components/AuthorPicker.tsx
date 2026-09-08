import { useMemo, useState } from 'react';
import type { Dataset } from '../lib/dataset.ts';

export function AuthorPicker({ ds, value, max, onChange }: {
  ds: Dataset; value: string[]; max: number; onChange: (authors: string[]) => void;
}) {
  const [q, setQ] = useState('');

  const authors = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of ds.all) {
      for (const a of b.authors) counts.set(a, (counts.get(a) ?? 0) + b.count);
    }
    return [...counts.entries()].sort((x, y) => y[1] - x[1]).map(([a]) => a);
  }, [ds]);

  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (n.length < 2) return [];
    const has = new Set(value.map((v) => v.toLowerCase()));
    return authors.filter((a) => a.toLowerCase().includes(n) && !has.has(a.toLowerCase())).slice(0, 7);
  }, [q, authors, value]);

  const add = (a: string) => { onChange([...value, a]); setQ(''); };
  const full = value.length >= max;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {value.map((a) => (
          <button key={a} onClick={() => onChange(value.filter((v) => v !== a))}
            className="group flex items-center gap-2 rounded-full border border-red-400/35 bg-red-400/10 py-1.5 pl-3 pr-2 text-sm">
            <span className="max-w-[220px] truncate">{a}</span>
            <span className="text-paper/40 group-hover:text-red-300">×</span>
          </button>
        ))}
      </div>

      {!full && (
        <div className="relative">
          <input value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && q.trim().length > 1) add(results[0] ?? q.trim()); }}
            placeholder="Yazar adı yaz..."
            className="w-full rounded-lg border border-paper/15 bg-ink-2 px-4 py-3 text-paper
                       outline-none placeholder:text-paper/30 focus:border-accent/60" />
          {results.length > 0 && (
            <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-lg border border-paper/15 bg-ink-2 shadow-2xl shadow-black/60">
              {results.map((a) => (
                <li key={a}>
                  <button onClick={() => add(a)} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-paper/8">
                    {a}
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
