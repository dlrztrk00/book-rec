import { makeFacetsFromSubjects } from './facetMatch.ts';

export type Book = {
  id: number; gr: number; title: string; authors: string[];
  year: number; pages: number; avg: number; count: number;
  genres: string[]; series: string; seriesNo: number; likes: number; tags: string[];
};

export type Facet = {
  id: string; label: string;
  tags: string[]; genres: string[]; re: string | null;
};
export type Neighbor = { id: number; score: number };

export type Dataset = {
  books: Book[];                 // index = book id (0 bos)
  all: Book[];
  facets: Facet[];
  meta: { books: number; ratings: number; readers: number; builtAt: string;
          sources: { name: string; url: string; license: string }[] };
  neighbors(id: number): Neighbor[];
  facetValue(id: number, facetIndex: number): number;   // 0..1
  facetVector(id: number): Float32Array;
  /** Open Library konu etiketlerini ayni 26 boyutlu vektore cevirir. */
  facetsFromSubjects(subjects: string[]): Float32Array;
  byGoodreadsId: Map<number, number>;
  descriptionOf(id: number): Promise<string | null>;
};

const base = import.meta.env.BASE_URL || '/';
const url = (p: string) => `${base}data/${p}`.replace(/\/{2,}/g, '/');

export async function loadDataset(onProgress?: (m: string) => void): Promise<Dataset> {
  onProgress?.('kitaplar');
  const [booksRaw, facetsRaw, meta] = await Promise.all([
    fetch(url('books.json')).then((r) => r.json()),
    fetch(url('facets.json')).then((r) => r.json()),
    fetch(url('meta.json')).then((r) => r.json()),
  ]);

  onProgress?.('benzerlik matrisi');
  const [simBuf, facetBuf] = await Promise.all([
    fetch(url('sim.bin')).then((r) => r.arrayBuffer()),
    fetch(url('facets.bin')).then((r) => r.arrayBuffer()),
  ]);

  const head = new DataView(simBuf);
  const magic = String.fromCharCode(head.getUint8(0), head.getUint8(1), head.getUint8(2), head.getUint8(3));
  if (magic !== 'BRSM') throw new Error('sim.bin bozuk');
  const N = head.getUint32(8, true);
  const K = head.getUint32(12, true);
  const simIds = new Uint16Array(simBuf, 16, N * K);
  const simScore = new Uint8Array(simBuf, 16 + N * K * 2, N * K);
  const facetBytes = new Uint8Array(facetBuf);
  const F: number = facetsRaw.facets.length;

  const genreNames: string[] = booksRaw.genres;
  const books: Book[] = new Array(N + 1);
  const all: Book[] = [];
  const byGoodreadsId = new Map<number, number>();
  for (const r of booksRaw.books as any[][]) {
    const b: Book = {
      id: r[0], gr: r[1], title: r[2], authors: r[3], year: r[4], pages: r[5],
      avg: r[6], count: r[7], genres: (r[8] as number[]).map((i) => genreNames[i]),
      series: r[9], seriesNo: r[10], likes: r[11], tags: r[12],
    };
    books[b.id] = b;
    all.push(b);
    if (b.gr) byGoodreadsId.set(b.gr, b.id);
  }

  const descCache = new Map<number, string | null>();
  const shardPromises = new Map<number, Promise<Record<string, string>>>();
  const SHARD: number = facetsRaw.descShard;

  return {
    books, all, facets: facetsRaw.facets, meta, byGoodreadsId,
    neighbors(id) {
      const out: Neighbor[] = [];
      if (id < 1 || id > N) return out;
      const off = (id - 1) * K;
      for (let k = 0; k < K; k++) {
        const nid = simIds[off + k];
        if (!nid) break;
        out.push({ id: nid, score: simScore[off + k] / 255 });
      }
      return out;
    },
    facetValue(id, fi) {
      if (id < 1 || id > N) return 0;
      return facetBytes[(id - 1) * F + fi] / 255;
    },
    facetVector(id) {
      const v = new Float32Array(F);
      if (id < 1 || id > N) return v;
      const off = (id - 1) * F;
      for (let i = 0; i < F; i++) v[i] = facetBytes[off + i] / 255;
      return v;
    },
    facetsFromSubjects: makeFacetsFromSubjects(facetsRaw.facets),
    async descriptionOf(id) {
      if (descCache.has(id)) return descCache.get(id)!;
      const shard = Math.floor((id - 1) / SHARD);
      let p = shardPromises.get(shard);
      if (!p) {
        p = fetch(url(`desc/${shard}.json`)).then((r) => r.json()).catch(() => ({}));
        shardPromises.set(shard, p);
      }
      const obj = await p;
      const d = obj[String(id)] ?? null;
      descCache.set(id, d);
      return d;
    },
  };
}
