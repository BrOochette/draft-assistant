import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createStatsUpdater, STATS_INTERVAL_MS, withNewChampions } from '../src/stats';

// Refus avant toute requête : aucun appel réseau dans ces tests.
const setup = async (lastUpdate: string | null, inChampSelect = false) => {
  const dir = await mkdtemp(join(tmpdir(), 'draft-stats-'));
  if (lastUpdate) await writeFile(join(dir, 'state.json'), JSON.stringify({ lastUpdate, patch: '16.21' }));
  return createStatsUpdater({ dir, data: dir, web: dir, images: dir }, () => inChampSelect, () => {});
};

describe('mise à jour des stats (appli desktop)', () => {
  it('une seule collecte par semaine', async () => {
    const recent = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
    const updater = await setup(recent);
    const s = await updater.status();
    expect(s.nextAllowed).toBe(new Date(new Date(recent).getTime() + STATS_INTERVAL_MS).toISOString());
    expect(await updater.start()).toMatchObject({ running: false, error: 'TOO_SOON' });
  });

  it('possible de nouveau après 7 jours', async () => {
    const old = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
    expect((await (await setup(old)).status()).nextAllowed).toBeNull();
  });

  it('refusée pendant une sélection des champions', async () => {
    const updater = await setup(null, true);
    expect(await updater.start()).toMatchObject({ running: false, error: 'IN_CHAMP_SELECT' });
  });

  it('ajoute les champions du wiki absents de l’installeur, garde les autres tels quels', async () => {
    const champ = (name: string, key: number) => ({ name, key, ddragonId: name, damage: 'AD' as const, provides: [], roles: ['Top' as const], classes: ['Fighter'] });
    const bundled = [champ('Garen', 86)];
    const r = await withNewChampions(bundled, async () => [{ ...champ('Garen', 86), damage: 'AP' as const }, champ('Zaahen', 999)]);
    expect(r.added.map((c) => c.name)).toEqual(['Zaahen']);
    expect(r.list.map((c) => c.name + ' ' + c.damage)).toEqual(['Garen AD', 'Zaahen AD']);
    // Wiki inaccessible : la liste de l'installeur seule.
    expect((await withNewChampions(bundled, () => Promise.reject(new Error('hors ligne')))).list).toEqual(bundled);
  });
});
