/**
 * Lecteur minimal de tables Lua littérales, suffisant pour `Module:ChampionData/data` du wiki LoL :
 * `return { ["Clé"] = { ... }, ... }`, chaînes, nombres, booléens, nil et commentaires `--`.
 * Une table dont toutes les clés sont 1..n devient un tableau, les autres deviennent des objets.
 */
export type LuaValue = string | number | boolean | null | LuaValue[] | { [key: string]: LuaValue };

export const parseLuaTable = (src: string): LuaValue => {
  let i = 0;

  const skip = () => {
    for (;;) {
      while (i < src.length && /\s/.test(src[i]!)) i++;
      if (src.startsWith('--', i)) {
        const end = src.indexOf('\n', i);
        i = end < 0 ? src.length : end + 1;
      } else return;
    }
  };
  const fail = (msg: string): never => {
    throw new Error(`Lua : ${msg} à la position ${i} (« ${src.slice(i, i + 30)} »)`);
  };
  const expect = (ch: string) => {
    skip();
    if (src[i] !== ch) fail(`« ${ch} » attendu`);
    i++;
  };

  const string = (): string => {
    const q = src[i];
    i++;
    let out = '';
    while (i < src.length && src[i] !== q) {
      if (src[i] === '\\') {
        const n = src[i + 1];
        out += n === 'n' ? '\n' : n === 't' ? '\t' : n ?? '';
        i += 2;
      } else out += src[i++];
    }
    if (src[i] !== q) fail('chaîne non terminée');
    i++;
    return out;
  };

  // Expressions numériques simples (certaines stats du wiki s'écrivent « 1000+1000/17 »).
  const factor = (): number => {
    skip();
    if (src[i] === '-') {
      i++;
      return -factor();
    }
    if (src[i] === '(') {
      i++;
      const v = sum();
      expect(')');
      return v;
    }
    const num = /^\d+(\.\d+)?(e-?\d+)?|^\.\d+/i.exec(src.slice(i, i + 40));
    if (!num) return fail('nombre attendu');
    i += num[0].length;
    return Number(num[0]);
  };
  const product = (): number => {
    let v = factor();
    for (skip(); src[i] === '*' || src[i] === '/'; skip()) v = src[i++] === '*' ? v * factor() : v / factor();
    return v;
  };
  const sum = (): number => {
    let v = product();
    // « -- » ouvre un commentaire, pas une soustraction.
    for (skip(); (src[i] === '+' || src[i] === '-') && !src.startsWith('--', i); skip()) v = src[i++] === '+' ? v + product() : v - product();
    return v;
  };

  const value = (): LuaValue => {
    skip();
    const ch = src[i];
    if (ch === '{') return table();
    if (ch === '"' || ch === "'") return string();
    if (/[\d.(-]/.test(ch ?? '')) return sum();
    const word = /^[A-Za-z_]\w*/.exec(src.slice(i, i + 40));
    if (word) {
      i += word[0].length;
      if (word[0] === 'true') return true;
      if (word[0] === 'false') return false;
      if (word[0] === 'nil') return null;
      return fail(`identifiant inattendu « ${word[0]} »`);
    }
    return fail('valeur attendue');
  };

  const table = (): LuaValue => {
    expect('{');
    const entries: [string | number, LuaValue][] = [];
    let next = 1;
    for (;;) {
      skip();
      if (src[i] === '}') {
        i++;
        break;
      }
      let key: string | number;
      if (src[i] === '[') {
        i++;
        const k = value();
        if (typeof k !== 'string' && typeof k !== 'number') fail('clé invalide');
        key = k as string | number;
        expect(']');
        expect('=');
      } else {
        const save = i;
        const word = /^[A-Za-z_]\w*/.exec(src.slice(i, i + 60));
        skip();
        if (word && /^\s*=(?!=)/.test(src.slice(i + word[0].length))) {
          i += word[0].length;
          expect('=');
          key = word[0];
        } else {
          i = save;
          key = next++;
        }
      }
      entries.push([key, value()]);
      skip();
      if (src[i] === ',' || src[i] === ';') i++;
    }
    const isArray = entries.every(([k], idx) => k === idx + 1);
    if (isArray) return entries.map(([, v]) => v);
    return Object.fromEntries(entries.map(([k, v]) => [String(k), v]));
  };

  skip();
  if (src.startsWith('return', i)) i += 'return'.length;
  return value();
};
