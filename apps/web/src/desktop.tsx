import { useEffect, useState } from 'react';
import { STATS_TEXT as T } from '@draft/i18n-fr';
import { Icon } from './ui';

// Appli desktop : mise à jour des stats Lolalytics par le processus principal (absent sur le site web).

export type StatsError = 'TOO_SOON' | 'IN_CHAMP_SELECT' | 'RUNNING' | 'ACCESS_DENIED' | 'NETWORK' | 'CANCELLED' | 'NO_DATA';
export interface StatsStatus {
  running: boolean;
  progress: { done: number; total: number; champion: string; paused: boolean } | null;
  lastUpdate: string | null;
  patch: string | null;
  nextAllowed: string | null;
  error: StatsError | null;
}
interface DesktopApi {
  stats: {
    status: () => Promise<StatsStatus>;
    start: () => Promise<StatsStatus>;
    cancel: () => Promise<void>;
    onChange: (cb: (s: StatsStatus) => void) => () => void;
  };
}

const desktop = (): DesktopApi | null => (window as unknown as { draftDesktop?: DesktopApi }).draftDesktop ?? null;

/**
 * Dans le chip du patch (appli desktop) : icône de mise à jour des stats (une fois par semaine), puis avancement de la
 * collecte et croix d'annulation. À la fin d'une collecte réussie, la page se recharge sur les nouvelles stats.
 */
export const StatsUpdate = () => {
  const api = desktop();
  const [s, setS] = useState<StatsStatus | null>(null);
  useEffect(() => {
    if (!api) return;
    let wasRunning = false;
    const apply = (next: StatsStatus) => {
      if (wasRunning && !next.running && !next.error) window.location.reload();
      wasRunning = next.running;
      setS(next);
    };
    void api.stats.status().then(apply);
    return api.stats.onChange(apply);
  }, [api]);
  if (!api || !s) return null;

  if (s.running && s.progress) {
    const { done, total, champion, paused } = s.progress;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return (
      <span className="chip-extra" role="status" aria-label={T.running} title={paused ? T.pausedTip : T.runningTip(champion)}>
        <span className={paused ? 'warn-text' : 'accent-text'}>{paused ? T.paused : T.progress(done, total)}</span>
        <span className="stats-bar" aria-hidden="true"><span style={{ width: pct + '%' }} /></span>
        <button type="button" className="chip-action" aria-label={T.cancel} title={T.cancel} onClick={() => void api.stats.cancel()}>
          <Icon name="close" size={12} />
        </button>
      </span>
    );
  }
  const blocked = s.nextAllowed != null;
  return (
    // Bouton grisé : pas de survol, l'infobulle passe sur le conteneur.
    <span className="chip-extra" title={blocked ? T.nextTip(s.nextAllowed!, s.lastUpdate) : undefined}>
      {s.error && s.error !== 'TOO_SOON' && <span className={s.error === 'CANCELLED' ? 'muted' : 'neg-text'} role="alert">{T.error[s.error]}</span>}
      <button
        type="button"
        className="chip-action"
        disabled={blocked}
        aria-label={T.start}
        title={blocked ? undefined : T.startTip(s.lastUpdate)}
        onClick={() => void api.stats.start().then(setS)}
      >
        <Icon name="refresh" size={13} />
      </button>
    </span>
  );
};
