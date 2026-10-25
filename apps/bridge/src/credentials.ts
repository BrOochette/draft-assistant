import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

/** Accès à l'API locale du client : port et mot de passe changent à chaque lancement. */
export interface LcuCredentials {
  port: number;
  password: string;
}

/** Fichier `lockfile` du client : « LeagueClient:pid:port:mot de passe:https ». */
export const parseLockfile = (text: string): LcuCredentials | null => {
  const [, , port, password] = text.trim().split(':');
  return port && password && /^\d+$/.test(port) ? { port: Number(port), password } : null;
};

/**
 * Ligne de commande de `LeagueClientUx` : `--app-port=` et `--remoting-auth-token=`. Les options
 * `--riotclient-app-port` et `--riotclient-auth-token` (client Riot, pas League) sont ignorées.
 */
export const parseCommandLine = (cmd: string): LcuCredentials | null => {
  const port = /(?:^|[\s"])--app-port=(\d+)/.exec(cmd)?.[1];
  const password = /(?:^|[\s"])--remoting-auth-token=([\w-]+)/.exec(cmd)?.[1];
  return port && password ? { port: Number(port), password } : null;
};

const LOCKFILES = ['C:/Riot Games/League of Legends/lockfile', '/Applications/League of Legends.app/Contents/LoL/lockfile'];

const run = promisify(execFile);

const commandLine = async (): Promise<string> => {
  if (process.platform === 'win32') {
    const ps = "Get-CimInstance Win32_Process -Filter \"name='LeagueClientUx.exe'\" | Select-Object -ExpandProperty CommandLine";
    return (await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true })).stdout;
  }
  return (await run('ps', ['-A', '-o', 'args='])).stdout.split('\n').filter((l) => l.includes('LeagueClientUx')).join('\n');
};

/**
 * Cherche le client ouvert : `LOL_LOCKFILE` si défini, puis la ligne de commande du processus (toute installation),
 * puis le `lockfile` des dossiers d'installation par défaut. null si le client est fermé.
 */
export const findCredentials = async (): Promise<LcuCredentials | null> => {
  const fromFile = async (path: string) => parseLockfile(await readFile(path, 'utf8').catch(() => ''));
  if (process.env.LOL_LOCKFILE) return fromFile(process.env.LOL_LOCKFILE);
  const fromProcess = parseCommandLine(await commandLine().catch(() => ''));
  if (fromProcess) return fromProcess;
  for (const path of LOCKFILES) {
    const found = await fromFile(path);
    if (found) return found;
  }
  return null;
};
