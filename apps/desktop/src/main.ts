import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, normalize, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, ipcMain, Menu, net, protocol, shell, type MenuItemConstructorOptions } from 'electron';
import { startBridge, type Bridge } from '@draft/bridge/server';
import { createStatsUpdater, localSnapshot, type StatsPaths } from './stats';
import { startUpdater } from './updater';

// Appli desktop Windows : l'appli web dans une fenêtre, avec le pont vers le client LoL démarré dans ce processus.
// Le mot de passe du client LoL reste ici (processus principal) : la page n'y a pas accès, elle lit la draft par le
// WebSocket local, comme l'appli web.

/** Origine de l'appli dans la fenêtre : un schéma maison, autorisé par le pont. */
const SCHEME = 'app';
const HOST = 'draft-assistant';
const ORIGIN = SCHEME + '://' + HOST;
/** `--dev` : la fenêtre charge le serveur Vite (npm run dev) au lieu de l'appli construite. */
const DEV_URL = process.argv.includes('--dev') ? 'http://localhost:5173' : null;
/** `--capture=fichier.png` (vérification) : capture de la page une fois chargée, puis l'appli se ferme. */
const CAPTURE = process.argv.find((a) => a.startsWith('--capture='))?.slice('--capture='.length) ?? null;
/**
 * `--smoke` (workflow de release) : l'appli s'ouvre, attend l'écran Draft avec ses stats (chip du patch, cartes des
 * joueurs), écrit « SMOKE OK » et quitte avec le code 0 ; code 1 si rien n'apparaît en 30 s ou si la page plante.
 */
const SMOKE = process.argv.includes('--smoke');
const SMOKE_TIMEOUT_MS = 30_000;
const SMOKE_CHECK = "!!document.querySelector('.brand-logo') && /Patch/.test(document.querySelector('.header')?.innerText ?? '') && document.querySelectorAll('.fit-member').length === 10";

// Schéma « standard » et « sécurisé » : stockage local (IndexedDB, localStorage) et fetch comme sur un site https.
protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

/** Fichiers de l'appli web construite : à côté de l'exécutable une fois installée, sinon apps/web/dist. */
const webDir = () => (app.isPackaged ? join(process.resourcesPath, 'web') : join(__dirname, '..', '..', 'web', 'dist'));

/** Stats collectées dans l'appli (dossier de l'utilisateur) et attributs des champions embarqués (ou data/ du dépôt). */
const statsPaths = (): StatsPaths => ({
  dir: join(app.getPath('userData'), 'stats'),
  data: app.isPackaged ? join(process.resourcesPath, 'data') : join(__dirname, '..', '..', '..', 'data'),
  web: webDir(),
  images: join(app.getPath('userData'), 'images')
});

/** Préférences de la fenêtre, gardées entre deux lancements. */
interface Prefs {
  alwaysOnTop: boolean;
  bounds?: { x: number; y: number; width: number; height: number };
  maximized?: boolean;
}
const prefsFile = () => join(app.getPath('userData'), 'window.json');
const readPrefs = (): Prefs => {
  try {
    return { alwaysOnTop: false, ...(JSON.parse(readFileSync(prefsFile(), 'utf8')) as Partial<Prefs>) };
  } catch {
    return { alwaysOnTop: false };
  }
};
const savePrefs = (p: Prefs) => {
  try {
    writeFileSync(prefsFile(), JSON.stringify(p));
  } catch {
    // Préférences perdues : la fenêtre reprendra sa taille par défaut.
  }
};

/** Sert l'appli web sur app://draft-assistant/ (pas de serveur, aucun appel réseau). */
const serveWeb = () => {
  const root = webDir();
  protocol.handle(SCHEME, (req) => {
    const { pathname } = new URL(req.url);
    // Stats mises à jour dans l'appli : prioritaires sur celles de l'installeur.
    if (pathname === '/data/snapshot.json' && existsSync(localSnapshot(statsPaths()))) return net.fetch(pathToFileURL(localSnapshot(statsPaths())).toString());
    // Portraits et illustrations des champions sortis après l'installeur, téléchargés par la mise à jour des stats.
    if (pathname.startsWith('/champions/')) {
      const images = statsPaths().images;
      const extra = normalize(join(images, decodeURIComponent(pathname)));
      if (extra.startsWith(images + sep) && existsSync(extra)) return net.fetch(pathToFileURL(extra).toString());
    }
    const file = normalize(join(root, decodeURIComponent(pathname === '/' ? '/index.html' : pathname)));
    // Rien en dehors du dossier de l'appli.
    if (file !== root && !file.startsWith(root + sep)) return new Response('Introuvable', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
};

const menu = (win: BrowserWindow, prefs: Prefs) => {
  const view: MenuItemConstructorOptions[] = [
    {
      label: 'Toujours au premier plan',
      type: 'checkbox',
      checked: prefs.alwaysOnTop,
      accelerator: 'CmdOrCtrl+T',
      click: (item) => {
        prefs.alwaysOnTop = item.checked;
        win.setAlwaysOnTop(item.checked);
        savePrefs(prefs);
      }
    },
    { type: 'separator' },
    { label: 'Recharger', role: 'reload' },
    { label: 'Plein écran', role: 'togglefullscreen' },
    { type: 'separator' },
    { label: 'Zoom avant', role: 'zoomIn' },
    { label: 'Zoom arrière', role: 'zoomOut' },
    { label: 'Taille réelle', role: 'resetZoom' }
  ];
  if (!app.isPackaged) view.push({ type: 'separator' }, { label: 'Outils de développement', role: 'toggleDevTools' });
  return Menu.buildFromTemplate([
    { label: 'Fichier', submenu: [{ label: 'Quitter', role: 'quit' }] },
    { label: 'Affichage', submenu: view }
  ]);
};

const createWindow = () => {
  const prefs = readPrefs();
  const win = new BrowserWindow({
    title: 'Draft Assistant',
    width: prefs.bounds?.width ?? 1600,
    height: prefs.bounds?.height ?? 960,
    ...(prefs.bounds && { x: prefs.bounds.x, y: prefs.bounds.y }),
    minWidth: 420,
    minHeight: 600,
    backgroundColor: '#121212',
    // Appli installée : l'icône est celle de l'exécutable ; en développement, celle du dossier build.
    ...(!app.isPackaged && { icon: join(__dirname, '..', 'build', 'icon.png') }),
    alwaysOnTop: prefs.alwaysOnTop,
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: join(__dirname, 'preload.cjs') }
  });
  if (prefs.maximized) win.maximize();
  win.setMenu(menu(win, prefs));
  win.once('ready-to-show', () => win.show());
  win.on('close', () => {
    prefs.maximized = win.isMaximized();
    if (!prefs.maximized) prefs.bounds = win.getBounds();
    savePrefs(prefs);
  });
  // Liens externes (Lolalytics, wiki…) : ouverts dans le navigateur, jamais dans la fenêtre de l'appli.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (ev, url) => {
    if (!url.startsWith(ORIGIN) && !(DEV_URL && url.startsWith(DEV_URL))) {
      ev.preventDefault();
      if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    }
  });
  // Hors appli installée : la console de la page est recopiée dans le terminal.
  if (!app.isPackaged) win.webContents.on('console-message', (_ev, level, message) => console.log('[page:' + level + '] ' + message));
  if (SMOKE) {
    const fail = (why: string) => {
      console.error('SMOKE ÉCHEC : ' + why);
      app.exit(1);
    };
    const timer = setTimeout(() => fail('écran Draft absent après ' + SMOKE_TIMEOUT_MS / 1000 + ' s'), SMOKE_TIMEOUT_MS);
    win.webContents.on('render-process-gone', (_ev, d) => fail('page arrêtée (' + d.reason + ')'));
    win.webContents.on('did-fail-load', (_ev, code, desc) => fail('chargement impossible (' + code + ' ' + desc + ')'));
    win.webContents.once('did-finish-load', () => {
      const poll = setInterval(() => {
        void win.webContents.executeJavaScript(SMOKE_CHECK).then((ok: boolean) => {
          if (!ok) return;
          clearInterval(poll);
          clearTimeout(timer);
          console.log('SMOKE OK');
          app.exit(0);
        }, () => {});
      }, 500);
    });
  }
  if (CAPTURE) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        void win.webContents.capturePage().then((img) => {
          writeFileSync(CAPTURE, img.toPNG());
          app.quit();
        });
      }, 2500);
    });
  }
  void win.loadURL(DEV_URL ?? ORIGIN + '/');
};

// Une seule instance : un deuxième lancement ramène la fenêtre déjà ouverte (et un seul pont sur le port).
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let bridge: Bridge | null = null;
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  void app.whenReady().then(() => {
    serveWeb();
    bridge = startBridge({
      origins: [ORIGIN],
      log: (msg) => console.log(msg),
      // Port déjà pris : un pont lancé à la main tourne déjà, l'appli s'y connecte.
      onError: (e) => console.error('Pont non démarré : ' + (e.code === 'EADDRINUSE' ? 'un autre pont tourne déjà.' : e.message))
    });
    // Mise à jour des stats : demandée par la page, état renvoyé à toutes les fenêtres.
    const stats = createStatsUpdater(statsPaths(), () => bridge?.inChampSelect() ?? false, (s) => {
      for (const w of BrowserWindow.getAllWindows()) w.webContents.send('stats:status', s);
    });
    ipcMain.handle('stats:status', () => stats.status());
    ipcMain.handle('stats:start', () => stats.start());
    ipcMain.handle('stats:cancel', () => stats.cancel());
    createWindow();
    if (!SMOKE) startUpdater(() => BrowserWindow.getAllWindows()[0], () => bridge?.inChampSelect() ?? false);
  });
  app.on('window-all-closed', () => {
    bridge?.close();
    app.quit();
  });
}
