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
