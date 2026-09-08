import type { Facet } from './dataset.ts';

/**
 * Serbest metin konu etiketlerini (Open Library `subject[]`) build sirasinda
 * kullanilan ayni 26 boyutlu vektore cevirir. Doyum egrisi build ile aynidir,
 * yoksa yerel ve yeni kitaplarin puanlari kiyaslanabilir olmaz.
 */
export function makeFacetsFromSubjects(facets: Facet[]) {
  const F = facets.length;
  const res = facets.map((f) => (f.re ? new RegExp(f.re) : null));
  const tagSets = facets.map((f) => new Set(f.tags));
  const genreSets = facets.map((f) => new Set(f.genres));

  return (subjects: string[]): Float32Array => {
    const raw = new Float32Array(F);
    subjects.slice(0, 40).forEach((s, i) => {
      const name = String(s).toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (!name) return;
      const w = 1 / (1 + i / 12);
      for (let fi = 0; fi < F; fi++) {
        if (tagSets[fi].has(name)) raw[fi] += w;
        else if (res[fi]?.test(name)) raw[fi] += w * 0.5;
        else if (genreSets[fi].has(name)) raw[fi] += w * 0.7;
      }
    });
    const v = new Float32Array(F);
    for (let i = 0; i < F; i++) v[i] = raw[i] / (raw[i] + 0.8);
    return v;
  };
}
