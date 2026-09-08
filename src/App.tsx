import { useEffect, useState } from 'react';
import { loadDataset, type Dataset } from './lib/dataset';
import type { LibraryEntry } from './lib/goodreads';
import type { Answers } from './lib/questions';
import * as store from './lib/storage';
import { Import } from './pages/Import';
import { Survey } from './pages/Survey';
import { Results } from './pages/Results';

export default function App() {
  const [ds, setDs] = useState<Dataset | null>(null);
  const [phase, setPhase] = useState('veri');
  const [error, setError] = useState<string | null>(null);

  const saved = store.load();
  const [library, setLibrary] = useState<LibraryEntry[]>(saved?.library ?? []);
  const [answers, setAnswers] = useState<Answers>(saved?.answers ?? {});
  const [step, setStep] = useState<store.Saved['step']>(saved?.step ?? 'import');
  const [stats, setStats] = useState(saved?.importStats);

  useEffect(() => {
    loadDataset(setPhase).then(setDs).catch((e) => setError(String(e?.message ?? e)));
  }, []);

  useEffect(() => { store.save({ library, answers, step, importStats: stats }); }, [library, answers, step, stats]);

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
        onSkip={() => { setLibrary([]); setStats(undefined); setStep('survey'); }}
        onDone={(r) => {
          setLibrary(r.entries);
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
    <Results ds={ds} library={library} answers={answers}
      onEdit={() => setStep('survey')}
      onReset={() => { store.clear(); setLibrary([]); setAnswers({}); setStats(undefined); setStep('import'); }} />
  );
}
