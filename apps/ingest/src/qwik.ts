/**
 * Lecture de l'état embarqué des pages Lolalytics (framework Qwik) : un bloc
 * `<script type="qwik/json">` dont `objs` est une liste plate. Dans un objet ou un tableau de cette liste,
 * une valeur chaîne est une référence (index en base 36) vers une autre entrée ; nombres et booléens sont en ligne.
 * On lit ces données structurées plutôt que la mise en page, plus fragile.
 */
type Obj = { [key: string]: unknown };

export interface QwikState {
  /** Premier objet, références résolues, qui satisfait le prédicat (appelé sur l'objet résolu en surface). */
  find(pred: (o: Obj) => boolean): Obj | undefined;
}

const MAX_DEPTH = 10;
const isObj = (o: unknown): o is Obj => !!o && typeof o === 'object' && !Array.isArray(o);

export const readQwikState = (html: string): QwikState => {
  const m = /<script type="qwik\/json">([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error('État Qwik introuvable dans la page');
  const { objs } = JSON.parse(m[1]!) as { objs: unknown[] };

  const ref = (v: unknown, depth: number): unknown => {
    if (typeof v !== 'string') return v;
    const target = objs[parseInt(v, 36)];
    if (target === undefined) return v;
    return depth < MAX_DEPTH ? expand(target, depth + 1) : target;
  };
  const expand = (o: unknown, depth: number): unknown => {
    if (Array.isArray(o)) return o.map((x) => ref(x, depth));
    if (isObj(o)) return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, ref(v, depth)]));
    return o;
  };
  // Résolution d'un seul niveau, pour tester les prédicats sans tout développer.
  const shallow = (o: Obj): Obj => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, typeof v === 'string' ? objs[parseInt(v, 36)] ?? v : v]));

  return {
    find: (pred) => {
      const raw = objs.find((o) => isObj(o) && pred(shallow(o)));
      return raw === undefined ? undefined : (expand(raw, 0) as Obj);
    }
  };
};
