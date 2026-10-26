import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Délai avant l'affichage au survol (le clavier l'affiche tout de suite). */
const SHOW_DELAY_MS = 250;
const GAP = 8;
const MARGIN = 8;

/**
 * Remplace l'infobulle native du navigateur : au survol, `title` passe en `data-tip` (le navigateur n'a plus rien à
 * montrer, sur l'élément comme sur ses parents) et le texte s'affiche dans une infobulle maison. Le texte reste
 * accessible : un élément sans nom ni texte garde le titre comme `aria-label`. Les composants peuvent aussi poser
 * `data-tip` directement (SVG, par exemple).
 */
export const TooltipLayer = () => {
  const [tip, setTip] = useState<{ text: string; rect: DOMRect } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number; below: boolean; arrow: number } | null>(null);

  useEffect(() => {
    let anchor: Element | null = null;
    let timer = 0;
    let observer: MutationObserver | null = null;

    const adopt = (el: Element) => {
      const t = el.getAttribute('title');
      if (t == null) return;
      el.removeAttribute('title');
      if (t) el.setAttribute('data-tip', t);
      if (t && !el.hasAttribute('aria-label') && !el.textContent?.trim()) el.setAttribute('aria-label', t);
    };
    // Tous les ancêtres perdent leur `title` (sinon le navigateur montrerait celui d'un parent) ; le plus proche gagne.
    const find = (start: EventTarget | null): Element | null => {
      let found: Element | null = null;
      for (let el = start instanceof Element ? start : null; el && el !== document.body; el = el.parentElement) {
        adopt(el);
        if (!found && el.getAttribute('data-tip')) found = el;
      }
      return found;
    };
    const hide = () => {
      window.clearTimeout(timer);
      observer?.disconnect();
      observer = null;
      anchor = null;
      setTip(null);
    };
    const show = (el: Element) => {
      const text = el.getAttribute('data-tip');
      if (text) setTip({ text, rect: el.getBoundingClientRect() });
    };
    const arm = (el: Element | null, delay: number) => {
      if (el === anchor) return;
      hide();
      if (!el) return;
      anchor = el;
      // React remet `title` quand le texte change : on le reprend, et l'infobulle suit.
      observer = new MutationObserver(() => {
        if (!anchor || !anchor.hasAttribute('title')) return;
        adopt(anchor);
        setTip((cur) => (cur ? { text: anchor!.getAttribute('data-tip') ?? '', rect: anchor!.getBoundingClientRect() } : cur));
      });
      observer.observe(el, { attributes: true, attributeFilter: ['title'] });
      timer = window.setTimeout(() => show(el), delay);
    };

    const onOver = (e: PointerEvent) => arm(find(e.target), SHOW_DELAY_MS);
    const onOut = (e: PointerEvent) => {
      if (anchor && !(e.relatedTarget instanceof Node && anchor.contains(e.relatedTarget))) hide();
    };
    const onFocus = (e: FocusEvent) => {
      const el = e.target instanceof Element && e.target.matches(':focus-visible') ? find(e.target) : null;
      arm(el, 0);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide();

    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onOut);
    document.addEventListener('focusin', onFocus);
    document.addEventListener('focusout', hide);
    document.addEventListener('pointerdown', hide);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      hide();
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
      document.removeEventListener('focusin', onFocus);
      document.removeEventListener('focusout', hide);
      document.removeEventListener('pointerdown', hide);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, []);

  // Au-dessus de l'élément, centré ; en dessous s'il manque la place ; jamais hors de la fenêtre.
  useLayoutEffect(() => {
    if (!tip || !box.current) return setPlace(null);
    const { width, height } = box.current.getBoundingClientRect();
    const center = tip.rect.left + tip.rect.width / 2;
    const left = Math.min(Math.max(center - width / 2, MARGIN), window.innerWidth - width - MARGIN);
    const below = tip.rect.top - height - GAP < MARGIN;
    const top = below ? tip.rect.bottom + GAP : tip.rect.top - height - GAP;
    setPlace({ left, top, below, arrow: Math.min(Math.max(center - left, 12), width - 12) });
  }, [tip]);

  if (!tip) return null;
  return createPortal(
    <div
      ref={box}
      className={'tooltip' + (place?.below ? ' is-below' : '')}
      role="tooltip"
      style={{ left: place?.left ?? -9999, top: place?.top ?? -9999, visibility: place ? 'visible' : 'hidden', ['--arrow-x' as string]: (place?.arrow ?? 0) + 'px' }}
    >
      {tip.text}
    </div>,
    document.body
  );
};
