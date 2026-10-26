import { request } from 'node:https';
import WebSocket, { WebSocketServer } from 'ws';
import { BRIDGE_PORT, BRIDGE_VERSION, type BridgeMessage, type ClientDraft } from '@draft/schemas';
import { findCredentials, type LcuCredentials } from './credentials';
import { riotIdOfSummoner, toClientDraft } from './lcu';
import { isAllowedOrigin } from './origin';

// Pont local en lecture seule : lit la sélection des champions dans le client LoL et la transmet à l'appli.
// Le mot de passe du client ne quitte pas ce processus et n'est jamais affiché.

const RETRY_MS = 2000;
const SESSION_EVENT = 'OnJsonApiEvent_lol-champ-select_v1_session';

export interface BridgeOptions {
  port?: number;
  /** Origines autorisées en plus des origines par défaut (par exemple l'appli desktop). */
  origins?: readonly string[];
  log?: (msg: string) => void;
  /** Le serveur n'a pas pu démarrer (port déjà pris : un autre pont tourne). */
  onError?: (e: NodeJS.ErrnoException) => void;
}

export interface Bridge {
  close: () => void;
  /** Une sélection des champions est en cours dans le client. */
  inChampSelect: () => boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const auth = (c: LcuCredentials) => 'Basic ' + Buffer.from('riot:' + c.password).toString('base64');

// Le client répond en HTTPS sur 127.0.0.1 avec un certificat auto-signé par Riot : pas de vérification, l'accès
// reste local (127.0.0.1 uniquement).
const get = (c: LcuCredentials, path: string): Promise<unknown | null> =>
  new Promise((resolve) => {
    const req = request({ host: '127.0.0.1', port: c.port, path, headers: { Authorization: auth(c) }, rejectUnauthorized: false }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => (body += chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) return resolve(null);
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.end();
  });

/** Démarre le pont : serveur WebSocket local pour l'appli, et suivi du client LoL tant qu'il n'est pas fermé. */
export const startBridge = ({ port = BRIDGE_PORT, origins = [], log = () => {}, onError }: BridgeOptions = {}): Bridge => {
  let stopped = false;
  // État courant, renvoyé à chaque appli qui se connecte.
  let clientConnected = false;
  let draft: ClientDraft | null = null;
  let lcu: WebSocket | null = null;

  const server = new WebSocketServer({
    host: '127.0.0.1',
    port,
    // Seule l'appli peut lire la draft : une autre page ouverte dans le navigateur est refusée.
    verifyClient: ({ origin }: { origin: string }) => isAllowedOrigin(origin) || (!!origin && origins.includes(origin))
  });
  const send = (ws: WebSocket, m: BridgeMessage) => ws.send(JSON.stringify(m));
  const broadcast = (m: BridgeMessage) => server.clients.forEach((ws) => ws.readyState === WebSocket.OPEN && send(ws, m));
  server.on('connection', (ws) => {
    send(ws, { type: 'client', connected: clientConnected, version: BRIDGE_VERSION });
    send(ws, { type: 'champSelect', draft });
  });
  server.on('listening', () => log('Pont prêt sur ws://127.0.0.1:' + port + '. En attente du client LoL…'));
  server.on('error', (e) => {
    stopped = true;
    onError?.(e as NodeJS.ErrnoException);
  });

  let localRiotId: string | null = null;
  const update = (raw: unknown | null) => {
    let next: ClientDraft | null = null;
    try {
      next = raw ? toClientDraft(raw, localRiotId) : null;
    } catch (e) {
      log('Session illisible, ignorée : ' + (e as Error).message);
      return;
    }
    if (!draft && next) log('Sélection des champions en cours.');
    if (draft && !next) log('Sélection des champions terminée.');
    draft = next;
    broadcast({ type: 'champSelect', draft });
  };

  /** Une connexion au client, jusqu'à sa fermeture. */
  const follow = (c: LcuCredentials) =>
    new Promise<void>((resolve) => {
      const ws = new WebSocket('wss://127.0.0.1:' + c.port + '/', { headers: { Authorization: auth(c) }, rejectUnauthorized: false });
      lcu = ws;
      ws.on('open', async () => {
        clientConnected = true;
        broadcast({ type: 'client', connected: true, version: BRIDGE_VERSION });
        log('Client LoL connecté.');
        ws.send(JSON.stringify([5, SESSION_EVENT]));
        localRiotId = riotIdOfSummoner(await get(c, '/lol-summoner/v1/current-summoner'));
        update(await get(c, '/lol-champ-select/v1/session'));
      });
      ws.on('message', (buf) => {
        // Événement : [8, nom, { eventType: Create | Update | Delete, data }].
        let msg: unknown;
        try {
          msg = JSON.parse(buf.toString());
        } catch {
          return;
        }
        if (!Array.isArray(msg) || msg[0] !== 8 || msg[1] !== SESSION_EVENT) return;
        const ev = msg[2] as { eventType?: string; data?: unknown };
        update(ev.eventType === 'Delete' ? null : ev.data ?? null);
      });
      ws.on('error', () => {});
      ws.on('close', () => {
        lcu = null;
        if (clientConnected) log('Client LoL fermé.');
        clientConnected = false;
        broadcast({ type: 'client', connected: false, version: BRIDGE_VERSION });
        update(null);
        resolve();
      });
    });

  void (async () => {
    while (!stopped) {
      const c = await findCredentials();
      if (c && !stopped) await follow(c);
      await sleep(RETRY_MS);
    }
  })();

  return {
    inChampSelect: () => draft != null,
    close: () => {
      stopped = true;
      lcu?.close();
      server.close();
    }
  };
};
