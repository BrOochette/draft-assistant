import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

// Ce que la page de l'appli desktop peut demander au processus principal : la mise à jour des stats, rien d'autre.
// La page le trouve dans `window.draftDesktop` ; sur le site web, il est absent.

contextBridge.exposeInMainWorld('draftDesktop', {
  stats: {
    status: () => ipcRenderer.invoke('stats:status'),
    start: () => ipcRenderer.invoke('stats:start'),
    cancel: () => ipcRenderer.invoke('stats:cancel'),
    onChange: (cb: (status: unknown) => void) => {
      const handler = (_ev: IpcRendererEvent, status: unknown) => cb(status);
      ipcRenderer.on('stats:status', handler);
      return () => {
        ipcRenderer.removeListener('stats:status', handler);
      };
    }
  }
});
