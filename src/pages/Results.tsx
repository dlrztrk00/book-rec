import { useEffect, useMemo, useState } from 'react';
import type { Dataset } from '../lib/dataset.ts';
import type { LibraryEntry } from '../lib/goodreads.ts';
import { clearFreshCache, fetchFresh, fetchFreshDescription, type FreshBook } from '../lib/openlibrary.ts';
import { derivePrefs, type Answers } from '../lib/questions.ts';
import { recommend, type Recommendation } from '../lib/recommend.ts';
import { Cover } from '../components/Cover.tsx';
import { MatchRing } from '../components/MatchRing.tsx';

const PART_LABELS: Record<keyof Recommendation['parts'], string> = {
  taste: 'Okuma geçmişin',
  prefs: 'Cevapların',
  quality: 'Okur puanı',
  discovery: 'Keşif ayarın',
};

function Bars({ parts, isNew }: { parts: Recommendation['parts']; isNew: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-1.5 sm:grid-cols-4">
      {(Object.keys(PART_LABELS) as (keyof Recommendation['parts'])[]).map((k) => (
        <div key={k}>
          <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wider text-paper/40">
            <span>{k === 'taste' && isNew ? 'Konu bağı' : PART_LABELS[k]}</span>
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

function Card({ rec, ds, onBlockAuthor }: {
  rec: Recommendation; ds: Dataset; onBlockAuthor: (author: string) => void;
}) {
  const [desc, setDesc] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const b = rec.book;

  useEffect(() => {
    let live = true;
    const p = rec.isNew
      ? fetchFreshDescription((b as FreshBook).workKey)
      : ds.descriptionOf(b.id);
    p.then((d) => live && setDesc(d));
    return () => { live = false; };
  }, [b, rec.isNew, ds]);

  const short = desc && desc.length > 420 ? desc.slice(0, 420).replace(/\s+\S*$/, '') + '…' : desc;

  return (
    <article className="rounded-xl border border-paper/12 bg-ink-2/70 p-5 transition hover:border-paper/25">
      <div className="flex gap-5">
        <Cover book={b} className="h-[132px] w-[88px] shrink-0" />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-[family-name:var(--font-display)] text-xl leading-tight">{b.title}</h3>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-paper/60">
                <span>{b.authors.join(', ')}</span>
                {b.authors[0] && (
                  <button onClick={() => onBlockAuthor(b.authors[0])}
                    title={`${b.authors[0]} kitaplarını bir daha gösterme`}
                    className="rounded border border-paper/15 px-1.5 py-0.5 text-[10px] text-paper/40
                               transition hover:border-red-400/50 hover:text-red-300">
                    bu yazarı gösterme
                  </button>
                )}
              </p>
              <p className="mt-1.5 text-xs text-paper/40">
                {[b.year || null, b.pages ? `${b.pages} sayfa` : null, `${b.avg.toFixed(2)} ★`,
                  `${(b.count / 1000).toFixed(0)}b puan`].filter(Boolean).join(' · ')}
              </p>
            </div>
            <MatchRing value={rec.match} />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {rec.isNew && (
              <span className="rounded-full bg-sky-400/15 px-2.5 py-1 text-[11px] text-sky-200/85">
                {b.year} · veri setinden yeni
              </span>
            )}
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

      {rec.isNew && (
        <div className="mt-4 rounded-lg bg-sky-400/6 px-4 py-3">
          <p className="mb-1.5 text-[11px] uppercase tracking-wider text-sky-200/50">
            Open Library'den canlı geldi
          </p>
          <p className="text-sm text-paper/60">
            Bu kitap ortak okur verisinin bittiği 2017’den sonra çıktı; öneri, sevdiğin
            kitapların konularıyla örtüşmesine dayanıyor — ortak okur sinyaline değil.
          </p>
        </div>
      )}

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
        <Bars parts={rec.parts} isNew={rec.isNew} />
      </div>
    </article>
  );
}

export function Results({ ds, library, readKeys, answers, onEdit, onReset, onBlockAuthor, onUnblockAuthor }: {
  ds: Dataset; library: LibraryEntry[]; readKeys: string[]; answers: Answers;
  onEdit: () => void; onReset: () => void;
  onBlockAuthor: (author: string) => void; onUnblockAuthor: (author: string) => void;
}) {
  const [count, setCount] = useState(12);
  const [fresh, setFresh] = useState<FreshBook[]>([]);
  const [net, setNet] = useState<'yukleniyor' | 'hazir' | 'yok'>('yukleniyor');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [nonce, setNonce] = useState(0);

  const prefs = useMemo(() => derivePrefs(answers), [answers]);
  const blockedAuthors = prefs.blockedAuthors;

  useEffect(() => {
    let live = true;
    setNet('yukleniyor');
    setProgress({ done: 0, total: 0 });
    const topFacets = Object.entries(prefs.facetWeights)
      .filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k]) => k);
    fetchFresh(ds, topFacets, (done, total) => live && setProgress({ done, total }))
      .then((list) => {
        if (!live) return;
        setFresh(list);
        setNet(list.length ? 'hazir' : 'yok');
      })
      .catch(() => live && setNet('yok'));
    return () => { live = false; };
  }, [ds, prefs, nonce]);

  const recs = useMemo(
    () => recommend(ds, library, prefs, count, fresh, readKeys),
    [ds, library, prefs, count, fresh, readKeys],
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
          <button onClick={() => { clearFreshCache(); setNonce((n) => n + 1); }}
            className="rounded-lg border border-paper/20 px-4 py-2.5 hover:border-paper/40">
            Yenileri tazele
          </button>
          <button onClick={onEdit} className="rounded-lg border border-paper/20 px-4 py-2.5 hover:border-paper/40">
            Cevapları değiştir
          </button>
          <button onClick={onReset} className="rounded-lg border border-paper/12 px-4 py-2.5 text-paper/50 hover:border-paper/30">
            Baştan
          </button>
        </div>
      </div>

      {blockedAuthors.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg bg-paper/4 px-4 py-3">
          <span className="text-xs text-paper/45">Gizlenen yazarlar:</span>
          {blockedAuthors.map((a) => (
            <button key={a} onClick={() => onUnblockAuthor(a)}
              className="group flex items-center gap-1.5 rounded-full border border-red-400/30 bg-red-400/10 py-1 pl-2.5 pr-1.5 text-[11px]">
              {a}<span className="text-paper/40 group-hover:text-red-300">×</span>
            </button>
          ))}
        </div>
      )}

      <div className="mb-6 flex items-center gap-2.5 text-xs text-paper/45">
        {net === 'yukleniyor' && (
          <>
            <span className="h-3 w-3 animate-spin rounded-full border border-paper/25 border-t-accent" />
            Open Library’den 2017 sonrası kitaplar getiriliyor
            {progress.total ? ` (${progress.done}/${progress.total})` : ''}…
          </>
        )}
        {net === 'hazir' && (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {fresh.length} yeni kitap havuza katıldı
          </>
        )}
        {net === 'yok' && (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Open Library’ye ulaşılamadı — yalnızca yerel 10.000 kitaplık havuz kullanılıyor
          </>
        )}
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
            {recs.map((r) => <Card key={r.book.id} rec={r} ds={ds} onBlockAuthor={onBlockAuthor} />)}
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
        . 2017 sonrası kitaplar{' '}
        <a href="https://openlibrary.org" target="_blank" rel="noreferrer noopener" className="underline hover:text-paper/60">Open Library</a>{' '}
        (CC0) üzerinden canlı getirilir. Puanlama tarayıcında yapılır; kütüphanen ve
        cevapların hiçbir yere gönderilmez — dışarı giden tek şey konu arama sorgularıdır.
      </footer>
    </div>
  );
}
