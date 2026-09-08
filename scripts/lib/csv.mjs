// RFC4180 uyumlu, tirnakli/cok satirli alanlari destekleyen CSV okuyucu.
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false, i = 0;
  if (text.charCodeAt(0) === 0xfeff) i = 1; // BOM
  for (; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function parseCsvObjects(text) {
  const rows = parseCsv(text);
  const header = rows[0];
  return rows.slice(1).filter(r => r.length === header.length)
    .map(r => Object.fromEntries(header.map((h, j) => [h, r[j]])));
}

// Python liste literali: "['A', 'B']" -> ['A','B']
export function parsePyList(s) {
  if (!s || s === '[]') return [];
  const out = [];
  const re = /(['"])((?:\\.|(?!\1)[^\\])*)\1/g;
  let m;
  while ((m = re.exec(s))) out.push(m[2].replace(/\\(.)/g, '$1'));
  return out;
}
