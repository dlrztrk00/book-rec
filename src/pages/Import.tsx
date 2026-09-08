import { useRef, useState } from 'react';
import type { Dataset } from '../lib/dataset';
import { importGoodreadsCsv, type ImportResult } from '../lib/goodreads';

export function Import({ ds, onDone, onSkip, existing }: {
  ds: Dataset;
  onDone: (r: ImportResult) => void;
  onSkip: () => void;
  existing?: { total: number; matched: number; rated: number };
}) {
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const r = importGoodreadsCsv(text, ds);
      if (!r.entries.length) {
        setError('Dosyayı okudum ama veri setiyle eşleşen kitap çıkmadı. Doğru CSV mi?');
        return;
      }
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dosya okunamadı.');
    }
  };

  const rated = result?.entries.filter((e) => e.myRating >= 4).length ?? 0;

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="mb-3 text-xs uppercase tracking-[0.2em] text-accent">Adım 1 / 3</p>
      <h1 className="mb-4 font-[family-name:var(--font-display)] text-4xl leading-tight">
        Okuma geçmişini tanıyayım
      </h1>
      <p className="mb-8 text-paper/65">
        Goodreads’ten dışa aktardığın CSV’yi buraya bırak. Beğendiğin kitaplardan yola çıkıp,
        <em className="not-italic text-paper/85"> aynı kitapları seven 53.406 okurun</em> başka neleri
        sevdiğine bakacağım.
      </p>

      {!result ? (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) handle(f); }}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition
              ${drag ? 'border-accent bg-accent/10' : 'border-paper/20 hover:border-paper/40'}`}
          >
            <div className="mb-2 text-3xl">📚</div>
            <div className="font-medium">goodreads_library_export.csv</div>
            <div className="mt-1 text-sm text-paper/45">sürükle bırak, ya da tıkla</div>
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }} />
          </div>

          {error && <p className="mt-4 rounded-lg bg-red-500/15 px-4 py-3 text-sm text-red-200">{error}</p>}

          <details className="mt-6 text-sm text-paper/55">
            <summary className="cursor-pointer hover:text-paper/80">CSV’yi nereden alıyorum?</summary>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-paper/50">
              <li>Goodreads’te <strong>My Books</strong> sayfasına git</li>
              <li>Sol altta <strong>Tools → Import and export</strong></li>
              <li><strong>Export Library</strong> butonuna bas, hazırlanan dosyayı indir</li>
            </ol>
          </details>

          <div className="mt-8 flex items-center gap-4 text-sm">
            <button onClick={onSkip} className="text-paper/50 underline underline-offset-4 hover:text-paper">
              Geçmişim olmadan devam et
            </button>
            {existing && (
              <span className="text-paper/40">
                (kayıtlı: {existing.matched} kitap)
              </span>
            )}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-paper/15 bg-ink-2 p-6">
          <h2 className="mb-4 font-[family-name:var(--font-display)] text-2xl">Kütüphanen okundu</h2>
          <dl className="mb-6 grid grid-cols-3 gap-4 text-center">
            {[
              ['satır okundu', result.totalRows],
              ['kitap eşleşti', result.entries.length],
              ['4+ yıldız verdiğin', rated],
            ].map(([label, n]) => (
              <div key={label as string} className="rounded-lg bg-paper/5 py-4">
                <dd className="font-[family-name:var(--font-display)] text-3xl">{n as number}</dd>
                <dt className="mt-1 text-xs text-paper/50">{label as string}</dt>
              </div>
            ))}
          </dl>

          {rated < 5 && (
            <p className="mb-4 rounded-lg bg-amber-500/12 px-4 py-3 text-sm text-amber-100/85">
              4+ yıldız verdiğin kitap az. Öneriler daha çok anket cevaplarına dayanacak —
              yine de çalışır, ama Goodreads’te puanladıkça isabet artar.
            </p>
          )}
          {result.unmatched.length > 0 && (
            <p className="mb-5 text-sm text-paper/45">
              {result.unmatched.length} kitap veri setinde yok (10.000 kitaplık havuzda bulunmayanlar).
              Bunlar öneri hesabına girmiyor.
            </p>
          )}

          <div className="flex gap-3">
            <button onClick={() => onDone(result)}
              className="rounded-lg bg-accent px-5 py-3 font-medium text-ink transition hover:bg-accent/85">
              Sorulara geç
            </button>
            <button onClick={() => setResult(null)}
              className="rounded-lg border border-paper/20 px-5 py-3 text-paper/70 hover:border-paper/40">
              Başka dosya
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
