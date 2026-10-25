import { useEffect, useState } from 'react';
import { BRIDGE_PORT, BRIDGE_VERSION, BridgeMessageSchema, type ClientDraft } from '@draft/schemas';

/**
 * État du client LoL vu par le pont local (`npm run bridge`). off : pont injoignable (l'appli fonctionne à la main) ;
 * closed : client fermé ; idle : client ouvert hors sélection ; champSelect : sélection des champions en cours ;
 * outdated : pont d'une autre version (lancé avant une mise à jour), certaines infos manquent.
 */
export type ClientStatus = 'off' | 'closed' | 'idle' | 'champSelect' | 'outdated';

export interface ClientState {
  status: ClientStatus;
  draft: ClientDraft | null;
}

const URL = 'ws://127.0.0.1:' + BRIDGE_PORT;
const RETRY_MIN_MS = 2000;
const RETRY_MAX_MS = 15000;

/** Suit le pont local, reconnecté en arrière-plan. Désactivé dans les tests. */
export const useClientBridge = (enabled = import.meta.env.MODE !== 'test'): ClientState => {
  const [state, setState] = useState<ClientState>({ status: 'off', draft: null });
  useEffect(() => {
    if (!enabled || typeof WebSocket === 'undefined') return;
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let delay = RETRY_MIN_MS;
    let stopped = false;
    let connected = false;
    let outdated = false;
    const connect = () => {
      ws = new WebSocket(URL);
      ws.onopen = () => (delay = RETRY_MIN_MS);
      ws.onmessage = (e) => {
        let raw: unknown;
        try {
          raw = JSON.parse(String(e.data));
        } catch {
          return;
        }
        const parsed = BridgeMessageSchema.safeParse(raw);
        if (!parsed.success) return;
        const m = parsed.data;
        if (m.type === 'client') {
          connected = m.connected;
          outdated = m.version !== BRIDGE_VERSION;
          setState((s) => ({ status: outdated ? 'outdated' : !m.connected ? 'closed' : s.draft ? 'champSelect' : 'idle', draft: m.connected ? s.draft : null }));
        } else {
          setState({ status: outdated ? 'outdated' : !connected ? 'closed' : m.draft ? 'champSelect' : 'idle', draft: m.draft });
        }
      };
      ws.onclose = () => {
        // Pont arrêté ou absent : la draft déjà lue reste affichée, on réessaie de plus en plus rarement.
        setState((s) => (s.status === 'off' ? s : { status: 'off', draft: null }));
        if (stopped) return;
        timer = setTimeout(connect, delay);
        delay = Math.min(delay * 2, RETRY_MAX_MS);
      };
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, [enabled]);
  return state;
};
