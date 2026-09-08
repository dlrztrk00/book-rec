import type { Book } from '../lib/dataset';

// Kapak gorselleri disaridan cekilmiyor (site tamamen cevrimdisi calisir),
// bunun yerine kitabin kimliginden tutarli bir kapak uretiliyor.
const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
};

export function Cover({ book, className = '' }: { book: Book; className?: string }) {
  const h = hash(book.title + (book.authors[0] ?? ''));
  const hue = h % 360;
  const hue2 = (hue + 40 + (h % 60)) % 360;
  const long = book.title.length > 28;

  return (
    <div
      className={`relative overflow-hidden rounded-sm shadow-lg shadow-black/40 ${className}`}
      style={{ background: `linear-gradient(150deg, hsl(${hue} 42% 26%), hsl(${hue2} 38% 14%))` }}
    >
      <div className="absolute inset-y-0 left-0 w-[6px] bg-black/30" />
      <div className="absolute inset-0 flex flex-col justify-between p-3">
        <div
          className={`font-[family-name:var(--font-display)] leading-tight text-paper/95 ${long ? 'text-[11px]' : 'text-[13px]'}`}
          style={{ textWrap: 'balance' }}
        >
          {book.title}
        </div>
        <div className="text-[9px] uppercase tracking-[0.14em] text-paper/55">
          {book.authors[0] ?? ''}
        </div>
      </div>
    </div>
  );
}
