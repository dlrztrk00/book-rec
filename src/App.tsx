import { useEffect, useState } from 'react';
import { loadDataset, type Dataset } from './lib/dataset.ts';
import type { LibraryEntry } from './lib/goodreads.ts';
import type { Answers } from './lib/questions.ts';
import * as store from './lib/storage.ts';
import { Import } from './pages/Import.tsx';
import { Survey } from './pages/Survey.tsx';
import { Results } from './pages/Results.tsx';

export default function App() {
  const [ds, setDs] = useState<Dataset | null>(null);
  const [phase, setPhase] = useState('veri');
  const [error, setError] = useState<string | null>(null);

  const saved = store.load();
  const [library, setLibrary] = useState<LibraryEntry[]>(saved?.library ?? []);
  const [readKeys, setReadKeys] = useState<string[]>(saved?.readKeys ?? []);
  const [answers, setAnswers] = useState<Answers>(saved?.answers ?? {});
  const [step, setStep] = useState<store.Saved['step']>(saved?.step ?? 'import');
  const [stats, setStats] = useState(saved?.importStats);

  useEffect(() => {
    loadDataset(setPhase).then(setDs).catch((e) => setError(String(e?.message ?? e)));
  }, []);

  useEffect(() => { store.save({ library, readKeys, answers, step, importStats: stats }); },
    [library, readKeys, answers, step, stats]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24">
        <h1 className="mb-3 font-[family-name:var(--font-display)] text-2xl">Veri yüklenemedi</h1>
        <p className="text-sm text-paper/60">{error}</p>
        <p className="mt-4 text-sm text-paper/40">
          <code className="rounded bg-paper/10 px-1.5 py-0.5">npm run data</code> komutunu çalıştırdın mı?
        </p>
      </div>
    );
  }

  if (!ds) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-paper/20 border-t-accent" />
          <p className="text-sm text-paper/45">{phase} yükleniyor…</p>
        </div>
      </div>
    );
  }

  if (step === 'import') {
    return (
      <Import ds={ds} existing={stats}
        onSkip={() => { setLibrary([]); setReadKeys([]); setStats(undefined); setStep('survey'); }}
        onDone={(r) => {
          setLibrary(r.entries);
          setReadKeys(r.readKeys);
          setStats({ total: r.totalRows, matched: r.entries.length, rated: r.entries.filter((e) => e.myRating >= 4).length });
          setStep('survey');
        }} />
    );
  }

  if (step === 'survey') {
    return (
      <Survey ds={ds} answers={answers} onChange={setAnswers}
        onBack={() => setStep('import')} onFinish={() => setStep('results')} />
    );
  }

  return (
    <Results ds={ds} library={library} readKeys={readKeys} answers={answers}
      onEdit={() => setStep('survey')}
      onUnblockAuthor={(a: string) => setAnswers((prev) => ({
        ...prev,
        blockedAuthors: (((prev.blockedAuthors as string[] | undefined) ?? []).filter((x) => x !== a)),
      }))}
      onBlockAuthor={(a: string) => setAnswers((prev) => {
        const cur = (prev.blockedAuthors as string[] | undefined) ?? [];
        return cur.includes(a) ? prev : { ...prev, blockedAuthors: [...cur, a] };
      })}
      onReset={() => { store.clear(); setLibrary([]); setReadKeys([]); setAnswers({}); setStats(undefined); setStep('import'); }} />
  );
}
