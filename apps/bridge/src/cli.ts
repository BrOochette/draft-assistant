import { BRIDGE_PORT } from '@draft/schemas';
import { startBridge } from './server';

// Pont lancé à la main (npm run bridge) pour l'appli web. L'appli desktop démarre le même pont elle-même.

const PORT = Number(process.env.DRAFT_BRIDGE_PORT) || BRIDGE_PORT;
const log = (msg: string) => console.log(new Date().toLocaleTimeString('fr-FR') + '  ' + msg);

startBridge({
  port: PORT,
  log,
  onError: (e) => {
    // Port déjà pris : le plus souvent, un pont lancé plus tôt tourne encore (avec l'ancien code), ou l'appli desktop.
    const inUse = e.code === 'EADDRINUSE';
    console.error(inUse ? 'Port ' + PORT + ' déjà utilisé : un pont tourne déjà (terminal ou appli desktop). Arrête-le, puis relance npm run bridge.' : 'Pont impossible à démarrer : ' + e.message);
    process.exit(1);
  }
});
