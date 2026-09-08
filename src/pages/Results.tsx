import { useEffect, useMemo, useState } from 'react';
import type { Dataset } from '../lib/dataset';
import type { LibraryEntry } from '../lib/goodreads';
import { derivePrefs, type Answers } from '../lib/questions';
import { recommend, type Recommendation } from '../lib/recommend';
import { Cover } from '../components/Cover';
import { MatchRing } from '../components/MatchRing';

const PART_LABELS: Record<keyof Recommendation['parts'], string> = {
  taste: 'Okuma geçmişin',
  prefs: 'Cevapların',
  quality: 'Okur puanı',
  discovery: 'Keşif ayarın',
};

function Bars({ parts }: { parts: Recommendation['parts'] }) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 sm:grid-cols-4">
      {(Object.keys(PART_LABELS) as (keyof Recommendation['parts'])[]).map((k) => (
        <div key={k}>
          <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wider text-paper/40">
            <span>{PART_LABELS[k]}</span>
            <span className="tabular-nums">{Math.round(parts[k] * 100)}</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-paper/10">
            <div className="h-full rounded-full bg-accent/70" style={{ width: `${parts[k] * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Card({ rec, ds }: { rec: Recommendation; ds: Dataset }) {
  const [desc, setDesc] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const b = rec.book;

  useEffect(() => { let live = true; ds.descriptionOf(b.id).then((d) => live && setDesc(d)); return () => { live = false; }; }, [b.id, ds]);

  const short = desc && desc.length > 420 ? desc.slice(0, 420).replace(/\s+\S*$/, '') + '…' : desc;

  return (
    <article className="rounded-xl border border-paper/12 bg-ink-2/70 p-5 transition hover:border-paper/25">
      <div className="flex gap-5">
        <Cover book={b} className="h-[132px] w-[88px] shrink-0" />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-[family-name:var(--font-display)] text-xl leading-tight">{b.title}</h3>
              <p className="mt-0.5 text-sm text-paper/60">{b.authors.join(', ')}</p>
              <p className="mt-1.5 text-xs text-paper/40">
                {[b.year || null, b.pages ? `${b.pages} sayfa` : null, `${b.avg.toFixed(2)} ★`,
                  `${(b.count / 1000).toFixed(0)}b puan`].filter(Boolean).join(' · ')}
              </p>
            </div>
            <MatchRing value={rec.match} />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {rec.inToRead && (
              <span className="rounded-full bg-accent/20 px-2.5 py-1 text-[11px] text-accent">
                zaten okunacaklar listende
              </span>
            )}
            {rec.seriesNote && (
              <span className="rounded-full bg-paper/8 px-2.5 py-1 text-[11px] text-paper/55">{rec.seriesNote}</span>
            )}
            {rec.matched.map((m) => (
              <span key={m} className="rounded-full bg-emerald-400/12 px-2.5 py-1 text-[11px] text-emerald-200/80">{m}</span>
            ))}
            {rec.missed.map((m) => (
              <span key={m} className="rounded-full bg-paper/6 px-2.5 py-1 text-[11px] text-paper/35 line-through">{m}</span>
            ))}
          </div>
        </div>
      </div>

      {rec.seeds.length > 0 && (
        <div className="mt-4 rounded-lg bg-paper/4 px-4 py-3">
          <p className="mb-1.5 text-[11px] uppercase tracking-wider text-paper/40">
            Bunu sevenler şunları da sevmiş — sen de sevmiştin
          </p>
          <p className="text-sm text-paper/75">
            {rec.seeds.map((s, i) => (
              <span key={s.book.id}>
                {i > 0 && <span className="text-paper/30"> · </span>}
                <span className="text-paper/90">{s.book.title}</span>
              </span>
            ))}
          </p>
        </div>
      )}

      <div className="mt-4">
        {short ? (
          <p className="text-sm leading-relaxed text-paper/70">
            {open ? desc : short}
            {desc && desc.length > 420 && (
              <button onClick={() => setOpen(!open)} className="ml-1.5 text-accent hover:underline">
                {open ? 'kısalt' : 'devamı'}
              </button>
            )}
          </p>
        ) : (
          <p className="text-sm text-paper/30">Bu kitabın özeti veri setinde yok.</p>
        )}
      </div>

      <div className="mt-4 border-t border-paper/8 pt-4">
        <Bars parts={rec.parts} />
      </div>
    </article>
  );
}

export function Results({ ds, library, answers, onEdit, onReset }: {
  ds: Dataset; library: LibraryEntry[]; answers: Answers;
  onEdit: () => void; onReset: () => void;
}) {
  const [count, setCount] = useState(12);
  const recs = useMemo(
    () => recommend(ds, library, derivePrefs(answers), count),
    [ds, library, answers, count],
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.2em] text-accent">Adım 3 / 3</p>
          <h1 className="font-[family-name:var(--font-display)] text-4xl">Senin için seçtiklerim</h1>
          <p className="mt-2 text-sm text-paper/50">
            {library.length > 0
              ? `${library.length} kitaplık geçmişin ve ${Object.keys(answers).length} cevabın üzerinden hesaplandı.`
              : `${Object.keys(answers).length} cevabın üzerinden hesaplandı.`}
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <button onClick={onEdit} className="rounded-lg border border-paper/20 px-4 py-2.5 hover:border-paper/40">
            Cevapları değiştir
          </button>
          <button onClick={onReset} className="rounded-lg border border-paper/12 px-4 py-2.5 text-paper/50 hover:border-paper/30">
            Baştan
          </button>
        </div>
      </div>

      {recs.length === 0 ? (
        <div className="rounded-xl border border-paper/15 bg-ink-2 p-8 text-center">
          <p className="mb-2 font-[family-name:var(--font-display)] text-xl">Filtreler fazla dar kaldı</p>
          <p className="text-sm text-paper/55">
            Uzunluk, dönem ya da “kesinlikle istemediklerim” seçimlerini biraz gevşetirsen liste dolacak.
          </p>
          <button onClick={onEdit} className="mt-5 rounded-lg bg-accent px-5 py-2.5 font-medium text-ink">
            Cevaplara dön
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {recs.map((r) => <Card key={r.book.id} rec={r} ds={ds} />)}
          </div>
          {count < 30 && (
            <button onClick={() => setCount(count + 12)}
              className="mt-6 w-full rounded-lg border border-paper/15 py-3.5 text-sm text-paper/60 hover:border-paper/35 hover:text-paper">
              Daha fazla göster
            </button>
          )}
        </>
      )}

      <footer className="mt-16 border-t border-paper/8 pt-6 text-xs leading-relaxed text-paper/35">
        Öneriler {ds.meta.readers.toLocaleString('tr')} okurun {ds.meta.ratings.toLocaleString('tr')} beğenisinden
        hesaplandı. Veri:{' '}
        {ds.meta.sources.map((s, i) => (
          <span key={s.url}>
            {i > 0 && ', '}
            <a href={s.url} target="_blank" rel="noreferrer noopener" className="underline hover:text-paper/60">{s.name}</a>
            {' '}({s.license})
          </span>
        ))}
        . Tüm hesap tarayıcında yapıldı; hiçbir veri dışarı gönderilmedi.
      </footer>
    </div>
  );
}
