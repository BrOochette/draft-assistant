import { request } from 'node:https';
import WebSocket, { WebSocketServer } from 'ws';
import { BRIDGE_PORT, BRIDGE_VERSION, type BridgeMessage, type ClientDraft } from '@draft/schemas';
import { findCredentials, type LcuCredentials } from './credentials';
import { riotIdOfSummoner, toClientDraft } from './lcu';
import { isAllowedOrigin } from './origin';

// Pont local en lecture seule : lit la sélection des champions dans le client LoL et la transmet à l'appli.
// Le mot de passe du client ne quitte pas ce processus et n'est jamais affiché.

const PORT = Number(process.env.DRAFT_BRIDGE_PORT) || BRIDGE_PORT;
const RETRY_MS = 2000;
const SESSION_EVENT = 'OnJsonApiEvent_lol-champ-select_v1_session';

const log = (msg: string) => console.log(new Date().toLocaleTimeString('fr-FR') + '  ' + msg);
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

// État courant, renvoyé à chaque appli qui se connecte.
let clientConnected = false;
let draft: ClientDraft | null = null;

const server = new WebSocketServer({
  host: '127.0.0.1',
  port: PORT,
  // Seule l'appli peut lire la draft : une autre page ouverte dans le navigateur est refusée.
  verifyClient: ({ origin }: { origin: string }) => isAllowedOrigin(origin)
});
const send = (ws: WebSocket, m: BridgeMessage) => ws.send(JSON.stringify(m));
const broadcast = (m: BridgeMessage) => server.clients.forEach((ws) => ws.readyState === WebSocket.OPEN && send(ws, m));
server.on('connection', (ws) => {
  send(ws, { type: 'client', connected: clientConnected, version: BRIDGE_VERSION });
  send(ws, { type: 'champSelect', draft });
});
server.on('listening', () => log('Pont prêt sur ws://127.0.0.1:' + PORT + '. En attente du client LoL…'));
server.on('error', (e) => {
  // Port déjà pris : le plus souvent, un pont lancé plus tôt tourne encore (avec l'ancien code).
  const inUse = (e as NodeJS.ErrnoException).code === 'EADDRINUSE';
  console.error(inUse ? 'Port ' + PORT + ' déjà utilisé : un pont tourne déjà. Arrête-le (Ctrl+C dans son terminal), puis relance npm run bridge.' : 'Pont impossible à démarrer : ' + e.message);
  process.exit(1);
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
    const lcu = new WebSocket('wss://127.0.0.1:' + c.port + '/', { headers: { Authorization: auth(c) }, rejectUnauthorized: false });
    lcu.on('open', async () => {
      clientConnected = true;
      broadcast({ type: 'client', connected: true, version: BRIDGE_VERSION });
      log('Client LoL connecté.');
      lcu.send(JSON.stringify([5, SESSION_EVENT]));
      localRiotId = riotIdOfSummoner(await get(c, '/lol-summoner/v1/current-summoner'));
      update(await get(c, '/lol-champ-select/v1/session'));
    });
    lcu.on('message', (buf) => {
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
    lcu.on('error', () => {});
    lcu.on('close', () => {
      if (clientConnected) log('Client LoL fermé.');
      clientConnected = false;
      broadcast({ type: 'client', connected: false, version: BRIDGE_VERSION });
      update(null);
      resolve();
    });
  });

for (;;) {
  const c = await findCredentials();
  if (c) await follow(c);
  await sleep(RETRY_MS);
}
