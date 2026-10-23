import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { assembleSampleSnapshot, type StatsSnapshot } from '@draft/schemas';

const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8'));

/** Construit le snapshot de stats à partir des données d'exemple. Lève une erreur zod si un fichier est invalide. */
export const buildSampleSnapshot = async (sampleDir: string): Promise<StatsSnapshot> =>
  assembleSampleSnapshot({
    champions: await readJson(join(sampleDir, 'champions.json')),
    candidates: await readJson(join(sampleDir, 'candidates.json')),
    matchupNotes: await readJson(join(sampleDir, 'matchup-notes.json')),
    banSuggestions: await readJson(join(sampleDir, 'ban-suggestions.json'))
  });

export const writeSnapshot = async (snapshot: StatsSnapshot, outFile: string): Promise<void> => {
  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, JSON.stringify(snapshot) + '\n', 'utf8');
};
