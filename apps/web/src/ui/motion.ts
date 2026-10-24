/** Animations d'interface. Toutes sont coupées si le système demande moins de mouvement. */
export const reducedMotion = (): boolean => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Fait voler une copie de `from` jusqu'à `to` (position et taille), puis rend `to` visible.
 * La copie est posée au-dessus de la page en position fixe : aucun élément réel ne bouge.
 */
export const fly = (from: DOMRect, source: Element, to: Element): void => {
  if (reducedMotion() || typeof (to as HTMLElement).animate !== 'function') return;
  const target = to as HTMLElement;
  const end = target.getBoundingClientRect();
  if (!from.width || !end.width) return;
  const ghost = source.cloneNode(true) as HTMLElement;
  ghost.classList.add('fly-ghost');
  Object.assign(ghost.style, { left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px' });
  document.body.appendChild(ghost);
  target.style.visibility = 'hidden';
  const dx = end.left - from.left;
  const dy = end.top - from.top;
  const scale = end.width / from.width;
  const anim = ghost.animate(
    [
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 1 }
    ],
    { duration: 420, easing: 'cubic-bezier(.2, .8, .2, 1)' }
  );
  let ended = false;
  const done = () => {
    if (ended) return;
    ended = true;
    ghost.remove();
    target.style.visibility = '';
    target.animate?.([{ transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 220, easing: 'ease-out' });
  };
  anim.onfinish = done;
  anim.oncancel = done;
  // Onglet en arrière-plan : l'horloge des animations s'arrête, le portrait réel revient quand même.
  setTimeout(done, 700);
};

/** Clé d'un emplacement de pick : « ally|Top|Camille ». */
export const slotKey = (side: 'ally' | 'enemy', role: string, champion: string): string => side + '|' + role + '|' + champion;

// Vol en attente : la source disparaît souvent au rendu suivant, on garde sa position et une copie.
let pending: { key: string; rect: DOMRect; el: Element } | null = null;

/** Retient le portrait cliqué, juste avant l'action qui place le champion. */
export const launchFrom = (source: Element | null | undefined, key: string): void => {
  pending = source ? { key, rect: source.getBoundingClientRect(), el: source.cloneNode(true) as Element } : null;
};

/** Appelé par l'emplacement qui vient d'afficher le champion : vol depuis la source, sinon petit rebond. */
export const land = (key: string, to: Element | null, pop = true): void => {
  if (!to || reducedMotion()) return;
  const p = pending?.key === key ? pending : null;
  if (p) pending = null;
  if (p) fly(p.rect, p.el, to);
  else if (pop) (to as HTMLElement).animate?.([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 220, easing: 'ease-out' });
};
