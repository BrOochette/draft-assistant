import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ChampionAttributesSchema, ChampionOverridesSchema, type ChampionAttributes } from '@draft/schemas';
import { politeFetch } from './http';
import { crawlLolalytics, DEFAULT_REGION, LolalyticsDumpSchema } from './lolalytics';
import { downloadPortraits, latestDdragonVersion } from './portraits';
import { buildSampleSnapshot, writeSnapshot } from './sample';
import { assembleLolalyticsSnapshot } from './snapshot';
import { applyOverrides, importWikiAttributes } from './wiki';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DATA = ROOT + 'data/';
const PUBLIC = ROOT + 'apps/web/public/';
const ATTRIBUTES = DATA + 'champions.json';
const OVERRIDES = DATA + 'champions-overrides.json';
const STATS = DATA + 'stats/';
const DDRAGON_VERSION = DATA + 'ddragon-version.txt';
const SNAPSHOT = PUBLIC + 'data/snapshot.json';

const USAGE = `Usage : npm run ingest -- <commande>

  wiki        Amorce les attributs des champions depuis le wiki LoL : data/champions.json
  lolalytics [région]  Collecte les stats du patch courant sur Lolalytics (région euw par défaut, « all » pour toutes)
              : data/stats/lolalytics-<patch>.json (environ 12 min)
  snapshot    Assemble le fichier chargé par l'appli (stats Lolalytics si présentes, sinon données d'exemple)
  sample      Force le snapshot sur les données d'exemple de la maquette
  portraits   Télécharge les portraits Data Dragon manquants dans apps/web/public/champions/`;

// La clé Riot ne sert à aucune commande. Si elle sert un jour, elle sera lue ici, jamais dans le code web :
// const riotKey = process.env.RIOT_API_KEY;

const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(path, 'utf8'));
const writeJson = (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2) + '\n', 'utf8');
const readAttributes = async (): Promise<ChampionAttributes[] | null> =>
  readJson(ATTRIBUTES).then((v) => ChampionAttributesSchema.array().parse(v), () => null);

/** Fichier de stats Lolalytics le plus récent (patch le plus élevé). */
const latestStatsFile = async (): Promise<string | null> => {
  const files = (await readdir(STATS).catch(() => [] as string[])).filter((f) => /^lolalytics-[\d.]+\.json$/.test(f));
  const patch = (f: string) => f.slice('lolalytics-'.length, -'.json'.length).split('.').map(Number);
  files.sort((a, b) => {
    const [pa, pb] = [patch(a), patch(b)];
    return (pb[0]! - pa[0]!) || (pb[1]! - pa[1]!);
  });
  return files[0] ? STATS + files[0] : null;
};

const main = async (cmd: string | undefined): Promise<number> => {
  switch (cmd) {
    case 'wiki': {
      const { champions, skipped } = await importWikiAttributes(politeFetch());
      await writeJson(ATTRIBUTES, champions);
      console.log(`Attributs écrits : ${champions.length} champions.` + (skipped.length ? ` Ignorés : ${skipped.join(', ')}.` : ''));
      return 0;
    }
    case 'lolalytics': {
      const attributes = await readAttributes();
      if (!attributes) throw new Error('data/champions.json manquant : lancer « npm run ingest -- wiki » d’abord.');
      // Cache du jour : une collecte interrompue reprend là où elle s'est arrêtée.
      const cacheDir = STATS + '.cache/' + new Date().toISOString().slice(0, 10);
      const log = (m: string) => console.log(m);
      const region = (process.argv[3] ?? DEFAULT_REGION).toLowerCase();
      if (!/^[a-z]+$/.test(region)) throw new Error('Région invalide : ' + region);
      const { dump, missing } = await crawlLolalytics(
        attributes,
        politeFetch({ delayMs: 1500, cacheDir, log }),
        politeFetch({ delayMs: 1500, cacheDir, log, referer: 'https://lolalytics.com/' }),
        log,
        region
      );
      const file = STATS + `lolalytics-${dump.patch}.json`;
      await writeFile(file, JSON.stringify(dump) + '\n', 'utf8');
      console.log(`Stats écrites (région ${region}) : ${file} (${Object.keys(dump.champions).length} champions).` + (missing.length ? ` Absents de Lolalytics : ${missing.join(', ')}.` : ''));
      return 0;
    }
    case 'snapshot': {
      const statsFile = await latestStatsFile();
      const attributes = await readAttributes();
      if (!statsFile || !attributes) return main('sample');
      const overrides = ChampionOverridesSchema.parse(await readJson(OVERRIDES).catch(() => ({})));
      const dump = LolalyticsDumpSchema.parse(await readJson(statsFile));
      const version = (await readFile(DDRAGON_VERSION, 'utf8').catch(() => '16.21.1')).trim();
      const snapshot = assembleLolalyticsSnapshot(applyOverrides(attributes, overrides), overrides, dump, version);
      await writeSnapshot(snapshot, SNAPSHOT);
      const counts = Object.entries(snapshot.candidates).map(([r, l]) => `${r} ${l.length}`).join(', ');
      console.log(`Snapshot Lolalytics écrit : patch ${snapshot.patch}, candidats ${counts}.`);
      return 0;
    }
    case 'sample': {
      const snapshot = await buildSampleSnapshot(DATA + 'sample');
      await writeSnapshot(snapshot, SNAPSHOT);
      console.log(`Snapshot d'exemple écrit : ${snapshot.champions.length} champions.`);
      return 0;
    }
    case 'portraits': {
      const attributes = await readAttributes();
      const ids = attributes ? attributes.map((c) => c.ddragonId) : Object.values((await readJson(DATA + 'ddragon-ids.json')) as Record<string, string>);
      const version = await latestDdragonVersion();
      const r = await downloadPortraits(ids, PUBLIC + 'champions', version);
      await writeFile(DDRAGON_VERSION, version + '\n', 'utf8');
      console.log(`Portraits ${version} : ${r.fetched} téléchargés, ${r.skipped} déjà présents.` + (r.failed.length ? ` Introuvables : ${r.failed.join(', ')}.` : ''));
      return 0;
    }
    default:
      console.error(USAGE);
      return 1;
  }
};

process.exitCode = await main(process.argv[2]).catch((e: Error) => {
  console.error(e.message);
  return 1;
});
