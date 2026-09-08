import { useState } from 'react';
import type { Dataset } from '../lib/dataset';
import { QUESTIONS, type Answers } from '../lib/questions';
import { BookPicker } from '../components/BookPicker';

export function Survey({ ds, answers, onChange, onFinish, onBack }: {
  ds: Dataset;
  answers: Answers;
  onChange: (a: Answers) => void;
  onFinish: () => void;
  onBack: () => void;
}) {
  const [i, setI] = useState(0);
  const q = QUESTIONS[i];
  const total = QUESTIONS.length;
  const value = answers[q.id];
  const set = (v: Answers[string]) => onChange({ ...answers, [q.id]: v });

  const answered =
    q.kind === 'multi' ? Array.isArray(value) && value.length > 0
    : q.kind === 'books' ? true
    : value !== undefined;

  const next = () => (i + 1 < total ? setI(i + 1) : onFinish());
  const prev = () => (i === 0 ? onBack() : setI(i - 1));

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-12">
      <div className="mb-10">
        <div className="mb-2 flex items-baseline justify-between text-xs uppercase tracking-[0.2em]">
          <span className="text-accent">{q.section}</span>
          <span className="text-paper/35">{i + 1} / {total}</span>
        </div>
        <div className="h-[3px] w-full overflow-hidden rounded-full bg-paper/10">
          <div className="h-full rounded-full bg-accent transition-all duration-300"
               style={{ width: `${((i + 1) / total) * 100}%` }} />
        </div>
      </div>

      <div className="flex-1">
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-3xl leading-snug">{q.prompt}</h2>
        {q.help && <p className="mb-7 text-sm text-paper/50">{q.help}</p>}
        {!q.help && <div className="mb-7" />}

        {q.kind === 'single' && (
          <div className="space-y-2.5">
            {q.options.map((o) => (
              <button key={o.value} onClick={() => { set(o.value); setTimeout(next, 160); }}
                className={`block w-full rounded-lg border px-5 py-4 text-left transition
                  ${value === o.value ? 'border-accent bg-accent/12' : 'border-paper/15 hover:border-paper/35'}`}>
                <div>{o.label}</div>
                {o.desc && <div className="mt-0.5 text-sm text-paper/45">{o.desc}</div>}
              </button>
            ))}
          </div>
        )}

        {q.kind === 'multi' && (
          <div className="flex flex-wrap gap-2.5">
            {q.options.map((o) => {
              const picked = Array.isArray(value) && (value as string[]).includes(o.value);
              const arr = (value as string[] | undefined) ?? [];
              const disabled = !picked && arr.length >= q.max;
              return (
                <button key={o.value} disabled={disabled}
                  onClick={() => set(picked ? arr.filter((v) => v !== o.value) : [...arr, o.value])}
                  className={`rounded-full border px-4 py-2.5 text-sm transition
                    ${picked ? 'border-accent bg-accent/15 text-paper'
                      : disabled ? 'cursor-not-allowed border-paper/8 text-paper/25'
                      : 'border-paper/15 text-paper/80 hover:border-paper/40'}`}>
                  {o.label}
                </button>
              );
            })}
          </div>
        )}

        {q.kind === 'scale' && (
          <div>
            <div className="flex justify-between gap-3">
              {[0, 1, 2, 3, 4].map((n) => (
                <button key={n} onClick={() => { set(n); setTimeout(next, 160); }}
                  className={`h-14 flex-1 rounded-lg border transition
                    ${value === n ? 'border-accent bg-accent/15' : 'border-paper/15 hover:border-paper/35'}`}>
                  <span className={`block h-2 rounded-full mx-auto transition-all
                    ${value === n ? 'bg-accent' : 'bg-paper/25'}`}
                    style={{ width: `${18 + Math.abs(n - 2) * 6}px` }} />
                </button>
              ))}
            </div>
            <div className="mt-3 flex justify-between text-sm text-paper/45">
              <span>{q.left}</span><span>{q.right}</span>
            </div>
          </div>
        )}

        {q.kind === 'books' && (
          <BookPicker ds={ds} max={q.max}
            value={(value as number[] | undefined) ?? []}
            onChange={(ids) => set(ids)} />
        )}
      </div>

      <div className="mt-10 flex items-center justify-between">
        <button onClick={prev} className="text-sm text-paper/45 hover:text-paper">← Geri</button>
        <div className="flex items-center gap-4">
          {!answered && q.kind !== 'books' && (
            <button onClick={next} className="text-sm text-paper/40 hover:text-paper/70">Atla</button>
          )}
          <button onClick={next} disabled={!answered && q.kind === 'multi'}
            className="rounded-lg bg-accent px-6 py-3 font-medium text-ink transition
                       hover:bg-accent/85 disabled:cursor-not-allowed disabled:bg-paper/15 disabled:text-paper/40">
            {i + 1 === total ? 'Önerileri göster' : 'Devam'}
          </button>
        </div>
      </div>
    </div>
  );
}
