import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { app, dialog, type BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';

// Mise à jour de l'appli installée, depuis les releases GitHub du dépôt (latest.yml joint par electron-builder).
// Vérifiée dès l'ouverture et téléchargée en arrière-plan, même pendant une draft (décidé le 27/10/2026 : seule
// exception à « aucun appel réseau pendant une draft »). L'utilisateur choisit de redémarrer tout de suite ou à la
// prochaine fermeture.

/** Journal de la mise à jour (%APPDATA%\Draft Assistant\logs\updater.log), pour comprendre un échec après coup. */
const fileLogger = () => {
  const dir = join(app.getPath('userData'), 'logs');
  const write = (level: string) => (...args: unknown[]) => {
    try {
      mkdirSync(dir, { recursive: true });
      appendFileSync(join(dir, 'updater.log'), new Date().toISOString() + ' ' + level + ' ' + args.map(String).join(' ') + '\n');
    } catch {
      // Journal impossible à écrire : la mise à jour continue.
    }
  };
  return { info: write('INFO'), warn: write('WARN'), error: write('ERROR'), debug: () => {} };
};

export const startUpdater = (window: () => BrowserWindow | undefined) => {
  if (!app.isPackaged) return;
  autoUpdater.logger = fileLogger();
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  // Pas de mise à jour possible (hors ligne, release sans latest.yml) : rien à signaler, l'appli continue.
  autoUpdater.on('error', () => {});

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
    // Installation silencieuse (sans les étapes de l'installeur), puis relance de l'appli.
    if (response === 0) autoUpdater.quitAndInstall(true, true);
  });

  autoUpdater.on('update-available', () => {
    void autoUpdater.downloadUpdate().catch(() => null);
  });
  void autoUpdater.checkForUpdates().catch(() => null);
};
