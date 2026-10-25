import { useState } from 'react';
import type { SuggestionMode } from '@draft/engine';
import { DRAFT_TEXT as D, SUGGESTION_MODE_LABEL, SUGGESTION_MODE_SHORT, SUGGESTION_MODE_TIP } from '@draft/i18n-fr';
import { ROLES, type Role } from '@draft/schemas';

// Type de suggestion (Mix, Synergie, Counter) de chaque rôle, partagé par l'écran Draft et la page test.

export const MODES: SuggestionMode[] = ['mix', 'synergy', 'counter'];
export type Modes = Record<Role, SuggestionMode>;
const MODES_KEY = 'draft-assistant:suggestion-modes';
/** Ancienne clé, un seul mode pour tous les rôles : reprise comme valeur de départ. */
const LEGACY_MODE_KEY = 'draft-assistant:suggestion-mode';

const isMode = (v: unknown): v is SuggestionMode => MODES.includes(v as SuggestionMode);
export const allModes = (m: SuggestionMode): Modes => Object.fromEntries(ROLES.map((r) => [r, m])) as Modes;

// Préférence de cet appareil seulement : sans stockage disponible, on revient au mode « mix ».
const readModes = (): Modes => {
  try {
    const saved = JSON.parse(localStorage.getItem(MODES_KEY) ?? 'null') as Partial<Record<Role, unknown>> | null;
    const legacy = localStorage.getItem(LEGACY_MODE_KEY);
    const base = allModes(isMode(legacy) ? legacy : 'mix');
    if (!saved) return base;
    for (const r of ROLES) if (isMode(saved[r])) base[r] = saved[r];
    return base;
  } catch {
    return allModes('mix');
  }
};
const saveModes = (m: Modes) => {
  try {
    localStorage.setItem(MODES_KEY, JSON.stringify(m));
  } catch {
    // Stockage indisponible : le choix vaut pour la session en cours.
  }
};

/** Modes des 5 rôles, mémorisés sur l'appareil. `shared` : le mode commun aux 5 rôles, null s'ils diffèrent. */
export const useSuggestionModes = () => {
  const [modes, setModes] = useState<Modes>(readModes);
  const update = (next: Modes) => {
    setModes(next);
    saveModes(next);
  };
  const shared = ROLES.every((r) => modes[r] === modes.Top) ? modes.Top : null;
  return { modes, shared, setAll: (m: SuggestionMode) => update(allModes(m)), setRole: (role: Role, m: SuggestionMode) => update({ ...modes, [role]: m }) };
};

/** Sélecteur global : règle les 5 rôles ; un mode n'est allumé que si tous les rôles le partagent. */
export const GlobalModes = ({ shared, onChange, labelId, short = false }: { shared: SuggestionMode | null; onChange: (m: SuggestionMode) => void; labelId: string; short?: boolean }) => (
  <div role="group" aria-labelledby={labelId} className={'segmented' + (short ? ' segmented-sm' : '')}>
    {MODES.map((m) => (
      <button key={m} type="button" className={'segment' + (shared === m ? ' is-on' : '')} aria-pressed={shared === m} title={SUGGESTION_MODE_TIP[m]} onClick={() => onChange(m)}>
        {(short ? SUGGESTION_MODE_SHORT : SUGGESTION_MODE_LABEL)[m]}
      </button>
    ))}
  </div>
);

/** Sélecteur d'un rôle, libellés courts. */
export const RoleModes = ({ role, mode, onChange }: { role: Role; mode: SuggestionMode; onChange: (m: SuggestionMode) => void }) => (
  <div role="group" aria-label={D.roleModes(role)} className="segmented segmented-sm">
    {MODES.map((m) => (
      <button
        key={m}
        type="button"
        className={'segment' + (mode === m ? ' is-on' : '')}
        aria-pressed={mode === m}
        aria-label={D.inRole(SUGGESTION_MODE_SHORT[m], role)}
        title={SUGGESTION_MODE_TIP[m]}
        onClick={() => onChange(m)}
      >
        {SUGGESTION_MODE_SHORT[m]}
      </button>
    ))}
  </div>
);
