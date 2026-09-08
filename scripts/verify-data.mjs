// Ham veriyi kullanmadan once dogrular. Basarisiz olursa build durur.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsvObjects, parsePyList } from './lib/csv.mjs';

const RAW = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'raw');
const read = (p) => readFileSync(join(RAW, p));
const sha = (b) => createHash('sha256').update(b).digest('hex');

let failures = 0, warnings = 0;
const ok = (m) => console.log(`  \x1b[32mOK\x1b[0m    ${m}`);
const warn = (m) => { warnings++; console.log(`  \x1b[33mUYARI\x1b[0m ${m}`); };
const fail = (m) => { failures++; console.log(`  \x1b[31mHATA\x1b[0m  ${m}`); };
const head = (m) => console.log(`\n\x1b[1m${m}\x1b[0m`);

// ---------------------------------------------------------------- A
head('A. Kaynak butunlugu (fork cekirdek veriyi degistirmis mi?)');
for (const f of ['ratings.csv', 'book_tags.csv', 'tags.csv', 'to_read.csv']) {
  const a = sha(read(`canon/${f}`)), b = sha(read(`ext/${f}`));
  if (a === b) ok(`${f.padEnd(15)} kanonik ile birebir ayni  ${a.slice(0, 12)}`);
  else fail(`${f} FARKLI! kanonik=${a.slice(0, 12)} fork=${b.slice(0, 12)}`);
}

// ---------------------------------------------------------------- B
head('B. Sema ve deger araliklari');
const ratingsRaw = read('canon/ratings.csv').toString('utf8');
if (ratingsRaw.includes('"')) fail('ratings.csv beklenmedik tirnak iceriyor');
const rLines = ratingsRaw.split('\n');
if (rLines[0].trim() !== 'user_id,book_id,rating') fail(`ratings.csv basligi beklenmedik: ${rLines[0]}`);
let rBad = 0, rCount = 0, maxUser = 0, maxBook = 0;
const seenUsers = new Set();
for (let i = 1; i < rLines.length; i++) {
  const l = rLines[i]; if (!l) continue;
  const p = l.split(',');
  if (p.length !== 3) { rBad++; continue; }
  const u = +p[0], b = +p[1], v = +p[2];
  if (!Number.isInteger(u) || !Number.isInteger(b) || !Number.isInteger(v)
      || u < 1 || b < 1 || b > 10000 || v < 1 || v > 5) { rBad++; continue; }
  rCount++; seenUsers.add(u);
  if (u > maxUser) maxUser = u;
  if (b > maxBook) maxBook = b;
}
rBad ? fail(`ratings.csv: ${rBad} gecersiz satir`) : ok(`ratings.csv: ${rCount.toLocaleString('tr')} puan, hepsi 1-5 araliginda`);
ok(`ratings.csv: ${seenUsers.size.toLocaleString('tr')} kullanici (max id ${maxUser}), kitap id max ${maxBook}`);

const tags = parseCsvObjects(read('canon/tags.csv').toString('utf8'));
const tagName = new Map();
let tDup = 0;
for (const t of tags) {
  if (!/^\d+$/.test(t.tag_id)) { fail(`tags.csv sayisal olmayan tag_id: ${t.tag_id}`); break; }
  if (tagName.has(+t.tag_id)) tDup++;
  tagName.set(+t.tag_id, t.tag_name);
}
tDup ? fail(`tags.csv: ${tDup} tekrar eden tag_id`) : ok(`tags.csv: ${tagName.size.toLocaleString('tr')} benzersiz etiket`);

const btRaw = read('canon/book_tags.csv').toString('utf8').split('\n');
let btBad = 0, btOrphan = 0, btNeg = 0, btCount = 0;
const btNegBooks = new Set();
for (let i = 1; i < btRaw.length; i++) {
  const l = btRaw[i]; if (!l) continue;
  const p = l.split(',');
  if (p.length !== 3 || !/^\d+$/.test(p[0]) || !/^\d+$/.test(p[1])) { btBad++; continue; }
  if (!tagName.has(+p[1])) { btOrphan++; continue; }
  if (!(+p[2] >= 0)) { btNeg++; btNegBooks.add(p[0]); continue; }
  btCount++;
}
btBad ? fail(`book_tags.csv: ${btBad} bozuk satir`) : ok(`book_tags.csv: ${btCount.toLocaleString('tr')} kitap-etiket baglantisi, hepsi gecerli`);
if (btOrphan) warn(`book_tags.csv: ${btOrphan} satir gecersiz tag_id'ye isaret ediyor (atilacak)`);
if (btNeg) warn(`book_tags.csv: ${btNeg} satirda negatif sayac (kitap ${[...btNegBooks].join(', ')}) -> build'de atilacak`);

// ---------------------------------------------------------------- C
head('C. Kimlik butunlugu (zenginlestirilmis dosya kitaplari degistirmis mi?)');
const canonBooks = parseCsvObjects(read('canon/books.csv').toString('utf8'));
const extBooks = parseCsvObjects(read('ext/books_enriched.csv').toString('utf8'));
if (canonBooks.length !== extBooks.length) fail(`kitap sayisi farkli: ${canonBooks.length} / ${extBooks.length}`);
else ok(`her iki dosyada da ${extBooks.length.toLocaleString('tr')} kitap`);

const canonById = new Map(canonBooks.map(b => [+b.book_id, b]));
let idMismatch = 0, grMismatch = 0, titleMismatch = 0;
for (const b of extBooks) {
  const c = canonById.get(+b.book_id);
  if (!c) { idMismatch++; continue; }
  if (+c.goodreads_book_id !== +b.goodreads_book_id) grMismatch++;
  if (c.title !== b.title) titleMismatch++;
}
idMismatch ? fail(`${idMismatch} kitap kanonik dosyada yok`) : ok('tum book_id degerleri kanonik dosyayla eslesiyor');
grMismatch ? fail(`${grMismatch} kitapta goodreads_book_id farkli`) : ok('tum goodreads_book_id degerleri ayni');
titleMismatch ? fail(`${titleMismatch} kitapta baslik degistirilmis`) : ok('tum basliklar birebir ayni -> sadece yeni sutun eklenmis');

// ---------------------------------------------------------------- D
head('D. Icerik guvenligi taramasi (serbest metin alanlari)');
const DANGER = [
  [/<\s*script/i, 'script etiketi'],
  [/<\s*iframe/i, 'iframe etiketi'],
  [/<\s*(object|embed)/i, 'object/embed etiketi'],
  [/javascript\s*:/i, 'javascript: URI'],
  [/data\s*:\s*text\/html/i, 'data:text/html URI'],
  [/\son[a-z]+\s*=\s*["']/i, 'inline olay isleyici'],
];
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const hits = new Map();
let htmlTagRows = 0, urlRows = 0, ctrlRows = 0, scanned = 0;
for (const b of extBooks) {
  for (const f of ['description', 'title', 'original_title', 'authors', 'genres', 'image_url']) {
    const v = b[f]; if (!v) continue;
    scanned++;
    for (const [re, label] of DANGER) if (re.test(v)) hits.set(label, (hits.get(label) || 0) + 1);
    if (/<[a-z/!][^>]{0,200}>/i.test(v)) htmlTagRows++;
    if (/https?:\/\//i.test(v) && f !== 'image_url') urlRows++;
    if (CTRL.test(v)) ctrlRows++;
  }
}
for (const t of tags) for (const [re, label] of DANGER) if (re.test(t.tag_name)) hits.set(label, (hits.get(label) || 0) + 1);

if (hits.size) for (const [label, n] of hits) fail(`${n} alanda ${label} bulundu`);
else ok(`${scanned.toLocaleString('tr')} metin alani + ${tagName.size.toLocaleString('tr')} etiket: script/iframe/javascript:/olay-isleyici YOK`);
htmlTagRows ? warn(`${htmlTagRows} alanda zararsiz HTML etiketi (<i>, <br> vb.) -> build'de soyulacak`) : ok('hicbir alanda HTML etiketi yok');
urlRows ? warn(`${urlRows} aciklamada URL var -> build'de silinecek`) : ok('aciklamalarda URL yok');
ctrlRows ? warn(`${ctrlRows} alanda kontrol karakteri -> build'de temizlenecek`) : ok('kontrol karakteri yok');

const hosts = new Set();
for (const b of extBooks) { const m = /^https?:\/\/([^/]+)/i.exec(b.image_url || ''); if (m) hosts.add(m[1].toLowerCase()); }
ok(`kapak gorseli alan adlari: ${[...hosts].join(', ') || 'yok'}`);

// ---------------------------------------------------------------- E
head('E. Tur alani kapali kume mi?');
const genreCount = new Map();
for (const b of extBooks) for (const g of parsePyList(b.genres)) genreCount.set(g, (genreCount.get(g) || 0) + 1);
const weird = [...genreCount.keys()].filter(g => !/^[a-z0-9-]{2,30}$/.test(g));
weird.length ? fail(`beklenmedik tur degerleri: ${weird.slice(0, 10).join(', ')}`)
             : ok(`${genreCount.size} tur, hepsi [a-z0-9-] formatinda`);

// ---------------------------------------------------------------- F
head('F. Zenginlestirilmis sutunlarin guvenilirligi');
const pyList = (v) => parsePyList(v).map((a) => a.replace(/^\[|\]$/g, '').trim().toLowerCase()).filter(Boolean);
let authorBad = 0;
const authorExamples = [];
for (const b of extBooks) {
  const c = canonById.get(+b.book_id); if (!c) continue;
  const first = String(c.authors || '').split(',')[0].trim().toLowerCase();
  const forkAuthors = pyList(b.authors);
  if (first && forkAuthors.length && !forkAuthors.includes(first)) {
    authorBad++;
    if (authorExamples.length < 3) authorExamples.push(`${c.title.slice(0, 32)}: kanonik="${c.authors.split(',')[0]}" fork="${forkAuthors[0]}"`);
  }
}
if (authorBad) {
  warn(`${authorBad} kitapta fork'un authors sutunu kanonikle celisiyor -> KANONIK kullanilir, fork'unki yok sayilir`);
  for (const e of authorExamples) console.log(`          ornek: ${e}`);
} else ok('authors sutunu kanonikle uyumlu');

// Aciklamalar dogru kitaba mi bagli? Baslik kelimesi aciklamada geciyor mu testi,
// karistirilmis taban cizgisiyle karsilastirilir.
const STOP = new Set('the and for with from that this book novel story stories about into their there when what which while national bestseller edition volume series'.split(' '));
const titleTokens = (t) => (t.replace(/\([^)]*\)/g, '').toLowerCase().match(/[a-z]{5,}/g) || []).filter((w) => !STOP.has(w));
const pairHit = (t, d) => {
  const tk = titleTokens(t);
  if (!tk.length || !d || d.length < 80) return null;
  const dl = d.toLowerCase();
  return tk.some((w) => dl.includes(w));
};
let realHit = 0, realTot = 0, shufHit = 0, shufTot = 0;
const descs = extBooks.map((b) => b.description);
let seed = 12345;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for (let i = descs.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [descs[i], descs[j]] = [descs[j], descs[i]]; }
extBooks.forEach((b, i) => {
  const r = pairHit(b.title, b.description);
  if (r !== null) { realTot++; if (r) realHit++; }
  const sres = pairHit(b.title, descs[i]);
  if (sres !== null) { shufTot++; if (sres) shufHit++; }
});
const realPct = (100 * realHit) / realTot, shufPct = (100 * shufHit) / shufTot;
if (realPct > shufPct * 3)
  ok(`aciklamalar dogru kitaba bagli: %${realPct.toFixed(1)} baslik eslesmesi (rastgele taban cizgisi %${shufPct.toFixed(1)})`);
else
  fail(`aciklamalar kaymis olabilir: %${realPct.toFixed(1)} vs taban cizgisi %${shufPct.toFixed(1)}`);

head('SONUC');
console.log(`  ${failures} hata, ${warnings} uyari`);
if (failures) { console.log('\n\x1b[31mDogrulama basarisiz - veri kullanilmayacak.\x1b[0m'); process.exit(1); }
console.log('\n\x1b[32mVeri dogrulandi.\x1b[0m Uyarilar build sirasinda temizlenerek giderilir.');
