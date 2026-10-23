import { fileURLToPath } from 'node:url';
import { downloadPortraits } from './portraits';
import { buildSampleSnapshot, writeSnapshot } from './sample';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DATA = ROOT + 'data/';
const PUBLIC = ROOT + 'apps/web/public/';
const DDRAGON_VERSION = '16.21.1';

const USAGE = `Usage : npm run ingest -- <commande>

  sample     Valide data/sample et écrit apps/web/public/data/snapshot.json
  portraits  Télécharge les portraits Data Dragon ${DDRAGON_VERSION} dans apps/web/public/champions/`;

// La clé Riot ne sert à aucune commande pour l'instant. Elle sera lue ici, jamais dans le code web :
// const riotKey = process.env.RIOT_API_KEY;

const main = async (cmd: string | undefined): Promise<number> => {
  switch (cmd) {
    case 'sample': {
      const snapshot = await buildSampleSnapshot(DATA + 'sample');
      await writeSnapshot(snapshot, PUBLIC + 'data/snapshot.json');
      console.log(`Snapshot écrit : ${snapshot.champions.length} champions, patch ${snapshot.patch}.`);
      return 0;
    }
    case 'portraits': {
      const r = await downloadPortraits(DATA + 'ddragon-ids.json', PUBLIC + 'champions', DDRAGON_VERSION);
      console.log(`Portraits : ${r.fetched} téléchargés, ${r.skipped} déjà présents.`);
      if (r.failed.length) console.error('Échec : ' + r.failed.join(', '));
      return r.failed.length ? 1 : 0;
    }
    default:
      console.error(USAGE);
      return 1;
  }
};

process.exitCode = await main(process.argv[2]);
