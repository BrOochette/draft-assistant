import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Polices embarquées (caractères latins, graisses utilisées) : aucun appel réseau, appli web comme desktop.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import './styles.css';
// Thème de l'appli, après les styles de base qu'il surcharge.
import './theme.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
