import { access, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const exists = (path: string) => access(path).then(() => true, () => false);

/** Dernière version publiée de Data Dragon. */
export const latestDdragonVersion = async (): Promise<string> => {
  const versions = (await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json()) as string[];
  if (!versions[0]) throw new Error('Liste des versions Data Dragon vide');
  return versions[0];
};

/** Télécharge les portraits Data Dragon manquants, une seule fois, pour qu'aucune draft ne dépende du réseau. */
export const downloadPortraits = async (ids: readonly string[], outDir: string, version: string): Promise<{ fetched: number; skipped: number; failed: string[] }> => {
  await mkdir(outDir, { recursive: true });
  let fetched = 0;
  let skipped = 0;
  const failed: string[] = [];
  for (const id of ids) {
    const file = join(outDir, id + '.png');
    if (await exists(file)) {
      skipped++;
      continue;
    }
    const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${id}.png`);
    if (!res.ok) {
      failed.push(id);
      continue;
    }
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
    fetched++;
  }
  return { fetched, skipped, failed };
};

const ART_ALIASES: Record<string, string> = { Fiddlesticks: 'FiddleSticks' };

/** Télécharge les illustrations centrées Data Dragon manquantes (fond des cartes joueurs de la vue client). */
export const downloadIllustrations = async (ids: readonly string[], outDir: string): Promise<{ fetched: number; skipped: number; failed: string[] }> => {
  await mkdir(outDir, { recursive: true });
  let fetched = 0;
  let skipped = 0;
  const failed: string[] = [];
  for (const id of ids) {
    const file = join(outDir, id + '.jpg');
    if (await exists(file)) {
      skipped++;
      continue;
    }
    // Data Dragon garde l'ancienne casse de quelques identifiants pour ces illustrations (FiddleSticks).
    const url = (name: string) => `https://ddragon.leagueoflegends.com/cdn/img/champion/centered/${name}_0.jpg`;
    let res = await fetch(url(id));
    if (res.status === 403 || res.status === 404) res = await fetch(url(ART_ALIASES[id] ?? id));
    if (!res.ok) {
      failed.push(id);
      continue;
    }
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
    fetched++;
  }
  return { fetched, skipped, failed };
};
