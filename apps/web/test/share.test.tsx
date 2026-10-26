import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { loadPools, loadRiotIds } from '../src/store';
import { playersFileName, readPlayersFile, toPlayersFile } from '../src/players/share';
import { sampleAppData } from './fixtures';

const known = (c: string) => c !== 'Inconnu';

describe('partage de la liste des joueurs', () => {
  it('exporte puis relit la même liste', () => {
    const pools = { Alex: { Top: [{ champion: 'Malphite', mastery: 8 }] }, Sam: {} };
    const file = toPlayersFile(pools, { Alex: ' Alex#EUW ' }, new Date('2026-10-26T10:00:00Z'));
    expect(file.players).toEqual([{ name: 'Alex', riotId: 'Alex#EUW', pools: pools.Alex }, { name: 'Sam', pools: {} }]);
    const back = readPlayersFile(JSON.stringify(file), { pools: {}, riotIds: {} }, known);
    expect(back).toMatchObject({ pools, riotIds: { Alex: 'Alex#EUW' }, players: [{ name: 'Alex', replaced: false }, { name: 'Sam', replaced: false }] });
    expect(playersFileName(new Date('2026-10-26T10:00:00Z'))).toBe('draft-assistant-joueurs-2026-10-26.json');
  });

  it('remplace les joueurs du même nom, ajoute les autres, garde le reste', () => {
    const current = { pools: { Alex: { Top: [{ champion: 'Garen', mastery: 3 }] }, Noa: {} }, riotIds: { Alex: 'Old#1', Noa: 'Noa#1' } };
    const file = toPlayersFile({ Alex: { Mid: [{ champion: 'Lux', mastery: 6 }] }, Zoé: {} }, {});
    const r = readPlayersFile(JSON.stringify(file), current, known);
    if ('error' in r) throw new Error(r.error);
    expect(Object.keys(r.pools)).toEqual(['Alex', 'Noa', 'Zoé']);
    expect(r.pools.Alex).toEqual({ Mid: [{ champion: 'Lux', mastery: 6 }] });
    expect(r.riotIds).toEqual({ Noa: 'Noa#1' });
    expect(r.players).toEqual([{ name: 'Alex', replaced: true }, { name: 'Zoé', replaced: false }]);
  });

  it('ignore les champions inconnus et les doublons', () => {
    const file = toPlayersFile({ Alex: { Top: [{ champion: 'Inconnu', mastery: 5 }, { champion: 'Garen', mastery: 5 }, { champion: 'Garen', mastery: 9 }] } }, {});
    const r = readPlayersFile(JSON.stringify(file), { pools: {}, riotIds: {} }, known);
    if ('error' in r) throw new Error(r.error);
    expect(r.pools.Alex?.Top).toEqual([{ champion: 'Garen', mastery: 5 }]);
    expect(r.unknown).toEqual(['Inconnu']);
  });

  it('refuse un fichier illisible, d’un autre format ou vide', () => {
    const cur = { pools: {}, riotIds: {} };
    expect(readPlayersFile('{', cur, known)).toEqual({ error: 'NOT_JSON' });
    expect(readPlayersFile('{"players":[]}', cur, known)).toEqual({ error: 'BAD_FORMAT' });
    expect(readPlayersFile(JSON.stringify(toPlayersFile({}, {})), cur, known)).toEqual({ error: 'EMPTY' });
  });

  it('importe un fichier depuis l’écran Joueurs après confirmation', async () => {
    const user = userEvent.setup();
    location.hash = '#/joueurs';
    render(<App initialData={sampleAppData()} />);
    await screen.findByRole('button', { name: /^Lou/ });
    const share = within(screen.getByRole('region', { name: 'Partager la liste' }));
    const content = JSON.stringify(toPlayersFile({ Lou: { ADC: [{ champion: 'Jinx', mastery: 9 }] }, Zoé: { Support: [{ champion: 'Janna', mastery: 7 }] } }, { Zoé: 'Zoé#EUW' }));
    await user.upload(share.getByLabelText('Fichier de joueurs à importer'), new File([content], 'joueurs.json', { type: 'application/json' }));

    const ask = within(await share.findByRole('group', { name: 'Importer ces joueurs' }));
    expect(ask.getByText('Lou').closest('li')).toHaveTextContent('remplacé');
    expect(ask.getByText('Zoé').closest('li')).toHaveTextContent('nouveau');
    await user.click(ask.getByRole('button', { name: 'Importer 2 joueurs' }));

    expect(share.getByRole('status')).toHaveTextContent('2 joueurs importés');
    expect(screen.getByRole('button', { name: /^Zoé/ })).toBeInTheDocument();
    await waitFor(async () => {
      expect((await loadPools()).Lou).toEqual({ ADC: [{ champion: 'Jinx', mastery: 9 }] });
      expect((await loadRiotIds()).Zoé).toBe('Zoé#EUW');
    });
  });

  it('signale un fichier qui n’est pas une liste de joueurs', async () => {
    const user = userEvent.setup();
    location.hash = '#/joueurs';
    render(<App initialData={sampleAppData()} />);
    await screen.findByRole('button', { name: /^Lou/ });
    const share = within(screen.getByRole('region', { name: 'Partager la liste' }));
    await user.upload(share.getByLabelText('Fichier de joueurs à importer'), new File(['{"a":1}'], 'autre.json', { type: 'application/json' }));
    expect(await share.findByRole('alert')).toHaveTextContent('n’est pas une liste de joueurs');
  });

  it('copie la liste en JSON dans le presse-papiers', async () => {
    const user = userEvent.setup();
    location.hash = '#/joueurs';
    render(<App initialData={sampleAppData()} />);
    await screen.findByRole('button', { name: /^Lou/ });
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const share = within(screen.getByRole('region', { name: 'Partager la liste' }));
    await user.click(share.getByRole('button', { name: 'Copier' }));
    expect(share.getByRole('status')).toHaveTextContent('JSON copié');
    const json = JSON.parse((writeText.mock.calls[0] as unknown as [string])[0]);
    expect(json.kind).toBe('draft-assistant/joueurs');
    expect(json.players.map((p: { name: string }) => p.name)).toContain('Lou');
  });

  it('« Coller » lit le presse-papiers et montre les joueurs avant import', async () => {
    const user = userEvent.setup();
    location.hash = '#/joueurs';
    render(<App initialData={sampleAppData()} />);
    await screen.findByRole('button', { name: /^Lou/ });
    const share = within(screen.getByRole('region', { name: 'Partager la liste' }));
    const readText = vi.fn(() => Promise.resolve('pas du json'));
    Object.defineProperty(navigator, 'clipboard', { value: { readText }, configurable: true });
    await user.click(share.getByRole('button', { name: 'Coller' }));
    expect(share.getByRole('alert')).toHaveTextContent('ce n’est pas du JSON');

    readText.mockResolvedValue(JSON.stringify(toPlayersFile({ Inès: { Support: [{ champion: 'Janna', mastery: 7 }] } }, {})));
    await user.click(share.getByRole('button', { name: 'Coller' }));
    const ask = within(share.getByRole('group', { name: 'Importer ces joueurs' }));
    expect(ask.getByText('Inès').closest('li')).toHaveTextContent('nouveau');
    await user.click(ask.getByRole('button', { name: 'Importer 1 joueur' }));
    expect(screen.getByRole('button', { name: /^Inès/ })).toBeInTheDocument();
  });

  it('presse-papiers illisible : une zone de texte permet de coller à la main', async () => {
    const user = userEvent.setup();
    location.hash = '#/joueurs';
    render(<App initialData={sampleAppData()} />);
    await screen.findByRole('button', { name: /^Lou/ });
    const share = within(screen.getByRole('region', { name: 'Partager la liste' }));
    Object.defineProperty(navigator, 'clipboard', { value: { readText: () => Promise.reject(new Error('refusé')) }, configurable: true });
    await user.click(share.getByRole('button', { name: 'Coller' }));
    await user.click(share.getByRole('textbox', { name: 'JSON des joueurs' }));
    await user.paste(JSON.stringify(toPlayersFile({ Yanis: {} }, {})));
    await user.click(share.getByRole('button', { name: 'Lire le JSON' }));
    expect(within(share.getByRole('group', { name: 'Importer ces joueurs' })).getByText('Yanis')).toBeInTheDocument();
    expect(share.queryByRole('textbox', { name: 'JSON des joueurs' })).not.toBeInTheDocument();
  });
});
