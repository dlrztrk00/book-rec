// Anket tanimi. Her cevap ya bir "boyut agirligi" ya da sert bir kisit uretir.
export type Answers = Record<string, string | string[] | number | number[] | undefined>;

export type Option = {
  value: string; label: string; desc?: string;
  facets?: Record<string, number>;
};

export type Question =
  | { id: string; section: string; prompt: string; help?: string; kind: 'single'; options: Option[] }
  | { id: string; section: string; prompt: string; help?: string; kind: 'multi'; max: number; options: Option[] }
  | { id: string; section: string; prompt: string; help?: string; kind: 'scale'; left: string; right: string; facetsLeft: Record<string, number>; facetsRight: Record<string, number> }
  | { id: string; section: string; prompt: string; help?: string; kind: 'books'; max: number };

export const QUESTIONS: Question[] = [
  { id: 'mood', section: 'Ruh hali', kind: 'single',
    prompt: 'Şu an nasıl bir okuma istiyorsun?',
    help: 'Buradan başlıyoruz — gerisi bunu inceltecek.',
    options: [
      { value: 'gripping', label: 'Beni içine çeksin, elimden bırakamayayım', facets: { fast: 1, twisty: .7 } },
      { value: 'thinky', label: 'Düşündürsün, altını çizesim gelsin', facets: { slow: 1, literary: .9, ideas: .5 } },
      { value: 'comfort', label: 'İyi hissettirsin, dinlendirsin', facets: { light: 1, hopeful: .9 } },
      { value: 'wreck', label: 'Sarssın, canımı acıtsın', facets: { dark: .9, emotional: 1 } },
      { value: 'escape', label: 'Beni başka bir dünyaya götürsün', facets: { fantasy: .9, scifi: .7, adventure: .7 } },
      { value: 'learn', label: 'Gerçek bir şey öğreteyim', facets: { truestory: 1, ideas: .8 } },
    ] },

  { id: 'tone', section: 'Ruh hali', kind: 'scale',
    prompt: 'Tonu nerede olsun?', left: 'Karanlık, ağır', right: 'Aydınlık, ferah',
    facetsLeft: { dark: 1, emotional: .4 }, facetsRight: { light: 1, hopeful: .6 } },

  { id: 'pace', section: 'Ruh hali', kind: 'scale',
    prompt: 'Tempo?', left: 'Yavaş, sindire sindire', right: 'Hızlı, nefes aldırmasın',
    facetsLeft: { slow: 1 }, facetsRight: { fast: 1 } },

  { id: 'depth', section: 'Ruh hali', kind: 'scale',
    prompt: 'Ağırlık?', left: 'Saf keyif', right: 'Edebi, iddialı',
    facetsLeft: { light: .7 }, facetsRight: { literary: 1, ideas: .4 } },

  { id: 'kind', section: 'Tür', kind: 'single',
    prompt: 'Kurgu mu, gerçek mi?',
    options: [
      { value: 'fiction', label: 'Kurgu', facets: { truestory: -.8 } },
      { value: 'nonfiction', label: 'Kurgu dışı', facets: { truestory: 1.2, ideas: .5 } },
      { value: 'either', label: 'Farketmez' },
    ] },

  { id: 'genres', section: 'Tür', kind: 'multi', max: 4,
    prompt: 'Hangi topraklarda gezinelim?', help: 'En fazla 4 tane seç.',
    options: [
      { value: 'fantasy', label: 'Fantastik', facets: { fantasy: 1 } },
      { value: 'scifi', label: 'Bilimkurgu', facets: { scifi: 1 } },
      { value: 'crime', label: 'Polisiye / suç', facets: { crime: 1, twisty: .4 } },
      { value: 'historical', label: 'Tarihi', facets: { historical: 1 } },
      { value: 'literary', label: 'Edebiyat / klasik', facets: { literary: 1 } },
      { value: 'realistic', label: 'Çağdaş gerçekçi', facets: { realistic: 1 } },
      { value: 'romance', label: 'Romantik', facets: { romance: 1 } },
      { value: 'dark', label: 'Korku / gerilim', facets: { dark: 1, fast: .3 } },
      { value: 'supernatural', label: 'Doğaüstü', facets: { supernatural: 1 } },
      { value: 'strange', label: 'Tuhaf / deneysel', facets: { strange: 1 } },
      { value: 'ideas', label: 'Fikir / bilim / felsefe', facets: { ideas: 1 } },
      { value: 'truestory', label: 'Anı / biyografi', facets: { truestory: 1 } },
      { value: 'comics', label: 'Çizgi roman', facets: { comics: 1 } },
      { value: 'shortform', label: 'Öykü / şiir', facets: { shortform: 1 } },
    ] },

  { id: 'themes', section: 'Tür', kind: 'multi', max: 5,
    prompt: 'Hangi temalar seni çeker?',
    options: [
      { value: 'family', label: 'Aile ve ilişkiler', facets: { family: 1 } },
      { value: 'social', label: 'Toplumsal / politik', facets: { social: 1 } },
      { value: 'comingofage', label: 'Büyüme hikâyesi', facets: { comingofage: 1 } },
      { value: 'adventure', label: 'Macera, hayatta kalma', facets: { adventure: 1 } },
      { value: 'historical', label: 'Geçmişe gitmek', facets: { historical: 1 } },
      { value: 'faith', label: 'İnanç, maneviyat', facets: { faith: 1 } },
      { value: 'strange', label: 'Gerçeküstü, tuhaf', facets: { strange: 1 } },
      { value: 'twisty', label: 'Bilmece, sürpriz son', facets: { twisty: 1 } },
    ] },

  { id: 'romance', section: 'İçerik', kind: 'single',
    prompt: 'Aşk hikâyesi?',
    options: [
      { value: 'none', label: 'İstemiyorum', facets: { romance: -1.2 } },
      { value: 'sub', label: 'Arka planda olsun', facets: { romance: .3 } },
      { value: 'main', label: 'Merkezde olsun', facets: { romance: 1.2 } },
      { value: 'any', label: 'Farketmez' },
    ] },

  { id: 'steam', section: 'İçerik', kind: 'single',
    prompt: 'Açık cinsel içerik?',
    options: [
      { value: 'no', label: 'Olmasın', facets: { steamy: -1.5 } },
      { value: 'ok', label: 'Rahatsız etmez' },
      { value: 'yes', label: 'Olsun', facets: { steamy: 1 } },
    ] },

  { id: 'avoid', section: 'İçerik', kind: 'multi', max: 6,
    prompt: 'Kesinlikle istemediğin bir şey var mı?',
    help: 'Bunlar sert filtre: seçtiklerin listeye hiç girmez.',
    options: [
      { value: 'dark', label: 'Ağır karanlık / şiddet' },
      { value: 'steamy', label: 'Erotik içerik' },
      { value: 'romance', label: 'Aşk odaklı kitaplar' },
      { value: 'faith', label: 'Dini / manevi içerik' },
      { value: 'supernatural', label: 'Vampir, hayalet vb.' },
      { value: 'comingofage', label: 'Genç yetişkin (YA)' },
      { value: 'comics', label: 'Çizgi roman' },
      { value: 'shortform', label: 'Öykü ve şiir' },
    ] },

  { id: 'length', section: 'Biçim', kind: 'single',
    prompt: 'Ne kadar uzun olsun?',
    options: [
      { value: 'short', label: 'Kısa — 250 sayfanın altı' },
      { value: 'medium', label: 'Orta — 250-450 sayfa' },
      { value: 'long', label: 'Uzun — 450 sayfa üstü' },
      { value: 'any', label: 'Farketmez' },
    ] },

  { id: 'era', section: 'Biçim', kind: 'single',
    prompt: 'Hangi dönemden?',
    options: [
      { value: 'new', label: 'Yeni — 2010 sonrası' },
      { value: 'modern', label: 'Modern — 1970 sonrası' },
      { value: 'classic', label: 'Klasik — 1960 öncesi' },
      { value: 'any', label: 'Farketmez' },
    ] },

  { id: 'series', section: 'Biçim', kind: 'single',
    prompt: 'Seri mi, tek kitap mı?',
    options: [
      { value: 'standalone', label: 'Tek kitaplık olsun, bağlanmayayım' },
      { value: 'first', label: 'Seri olabilir ama ilk kitabından başlayayım' },
      { value: 'any', label: 'Farketmez' },
    ] },

  { id: 'popularity', section: 'Keşif', kind: 'single',
    prompt: 'Ne kadar bilinen olsun?',
    options: [
      { value: 'popular', label: 'Herkesin konuştuğu kitaplar' },
      { value: 'any', label: 'Farketmez' },
      { value: 'hidden', label: 'Az bilinen, keşif olsun' },
    ] },

  { id: 'freshness', section: 'Keşif', kind: 'single',
    prompt: 'Yeni çıkanlar mı, oturmuş kitaplar mı?',
    help: '2017 sonrası kitaplar Open Library’den canlı gelir; arkalarında ortak okur verisi yoktur, eşleşme konu benzerliğine dayanır.',
    options: [
      { value: 'new', label: 'Ağırlıklı yeni çıkanlar olsun' },
      { value: 'balanced', label: 'Karışık olsun' },
      { value: 'classics', label: 'Sadece oturmuş kitaplar — yeni istemiyorum' },
    ] },

  { id: 'novelty', section: 'Keşif', kind: 'single',
    prompt: 'Alıştığın tarza ne kadar yakın olsun?',
    help: 'Okuma geçmişin varsa bu ayarı kullanır.',
    options: [
      { value: 'safe', label: 'Tam sevdiğim türde, garanti olsun' },
      { value: 'stretch', label: 'Biraz dışına çıksın' },
      { value: 'wild', label: 'Beni tamamen şaşırt' },
    ] },

  { id: 'likeBooks', section: 'Keşif', kind: 'books', max: 3,
    prompt: 'Şuna benzer bir şey istiyorum...',
    help: 'İstersen 1-3 kitap seç; öneriler bunlara komşu olanlardan gelir.' },
];

// ---------------------------------------------------------------- cevaplar -> tercihler
export type Prefs = {
  facetWeights: Record<string, number>;
  kind: 'fiction' | 'nonfiction' | 'either';
  avoid: string[];
  pages: [number, number] | null;
  year: [number, number] | null;
  series: 'any' | 'standalone' | 'first';
  freshness: 'new' | 'balanced' | 'classics';
  popularity: 'popular' | 'any' | 'hidden';
  novelty: 'safe' | 'stretch' | 'wild';
  likeBooks: number[];
};

const add = (w: Record<string, number>, f: Record<string, number> | undefined, k = 1) => {
  if (!f) return;
  for (const [id, v] of Object.entries(f)) w[id] = (w[id] || 0) + v * k;
};

export function derivePrefs(answers: Answers): Prefs {
  const w: Record<string, number> = {};
  const byId = new Map(QUESTIONS.map((q) => [q.id, q]));

  for (const [qid, a] of Object.entries(answers)) {
    const q = byId.get(qid);
    if (!q || a === undefined) continue;
    if (q.kind === 'single' && typeof a === 'string') {
      add(w, q.options.find((o) => o.value === a)?.facets);
    } else if (q.kind === 'multi' && Array.isArray(a)) {
      const picked = (a as string[]);
      for (const v of picked) add(w, q.options.find((o) => o.value === v)?.facets, 1 / Math.sqrt(picked.length || 1));
    } else if (q.kind === 'scale' && typeof a === 'number') {
      const t = (a - 2) / 2;                       // -1 .. 1
      if (t < 0) add(w, q.facetsLeft, -t);
      else if (t > 0) add(w, q.facetsRight, t);
    }
  }

  const avoid = (answers.avoid as string[] | undefined) ?? [];
  for (const f of avoid) w[f] = Math.min(w[f] ?? 0, -2);

  const lengthMap: Record<string, [number, number]> = {
    short: [1, 260], medium: [240, 470], long: [430, 5000],
  };
  const eraMap: Record<string, [number, number]> = {
    new: [2010, 2100], modern: [1970, 2100], classic: [0, 1960],
  };

  return {
    facetWeights: w,
    kind: (answers.kind as Prefs['kind']) ?? 'either',
    avoid,
    pages: lengthMap[answers.length as string] ?? null,
    year: eraMap[answers.era as string] ?? null,
    series: (answers.series as Prefs['series']) ?? 'any',
    freshness: (answers.freshness as Prefs['freshness']) ?? 'balanced',
    popularity: (answers.popularity as Prefs['popularity']) ?? 'any',
    novelty: (answers.novelty as Prefs['novelty']) ?? 'stretch',
    likeBooks: (answers.likeBooks as number[] | undefined) ?? [],
  };
}
