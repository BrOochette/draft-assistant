import { app, dialog, type BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';

// Mise à jour de l'appli installée, depuis les releases GitHub du dépôt (latest.yml joint par electron-builder).
// Vérifiée au démarrage, téléchargée en arrière-plan, jamais pendant une sélection des champions (aucun appel réseau
// pendant une draft). L'utilisateur choisit de redémarrer tout de suite ou à la prochaine fermeture.

/** Délai après le lancement avant la vérification (le pont a eu le temps de lire le client LoL). */
const START_DELAY_MS = 15_000;
const POLL_MS = 5_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const startUpdater = (window: () => BrowserWindow | undefined, inChampSelect: () => boolean) => {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  // Pas de mise à jour possible (hors ligne, release sans latest.yml) : rien à signaler, l'appli continue.
  autoUpdater.on('error', () => {});

  const outsideDraft = async () => {
    while (inChampSelect()) await sleep(POLL_MS);
  };

  autoUpdater.on('update-downloaded', async (info) => {
    const win = window();
    const options = {
      type: 'info' as const,
      title: 'Mise à jour',
      message: 'Draft Assistant ' + info.version + ' est prête.',
      detail: 'Elle s’installe au redémarrage de l’appli. Joueurs, pools et stats sont conservés.',
      buttons: ['Redémarrer maintenant', 'Au prochain lancement'],
      defaultId: 0,
      cancelId: 1
    };
    const { response } = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options);
    if (response === 0) autoUpdater.quitAndInstall();
  });

  // Nouvelle version trouvée : téléchargée hors draft.
  autoUpdater.on('update-available', () => {
    void outsideDraft().then(() => autoUpdater.downloadUpdate().catch(() => null));
  });

  void (async () => {
    await sleep(START_DELAY_MS);
    await outsideDraft();
    await autoUpdater.checkForUpdates().catch(() => null);
  })();
};
