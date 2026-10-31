import { mkdir, mkdtemp, readdir, readFile, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BuildRequestSchema, createBuildLoader, RETENTION_MS, type BuildRequest } from '../src/builds';

// Page Lolalytics réduite à l'état Qwik lu par l'analyse : objets référencés par leur index en base 36.
const page = (wr: number, n: number) =>
  `<script type="qwik/json">${JSON.stringify({ objs: [{ summary: '1', header: '2', n }, {}, { wr, n }] })}</script>`;
const vs: BuildRequest = { patch: '16.21', champion: 'Aatrox', role: 'Top', opponent: 'Darius' };

const setup = async (respond: (url: string) => Promise<Response>, online = true) => {
  const dir = await mkdtemp(join(tmpdir(), 'draft-builds-'));
  const urls: string[] = [];
  const loader = createBuildLoader(dir, () => online, {
    delayMs: 0,
    fetchPage: (url) => {
      urls.push(url);
      return respond(url);
    }
  });
  return { dir, urls, loader };
};

describe('builds chargés à la demande (appli desktop)', () => {
  it('build contre un adversaire : page vs avec vslane, puis lu dans le cache', async () => {
    const { urls, loader } = await setup(async () => new Response(page(49.78, 5472)));
    expect(await loader.load(vs)).toMatchObject({ ok: true, games: 5472, winRate: 49.78 });
    expect(urls).toEqual(['https://lolalytics.com/lol/aatrox/vs/darius/build/?lane=top&vslane=top&tier=emerald_plus']);
    expect(await loader.load(vs)).toMatchObject({ ok: true, games: 5472 });
    expect(urls).toHaveLength(1);
  });

  it('page de runes par rune principale', async () => {
    const { urls, loader } = await setup(async () => new Response(page(51, 9000)));
    await loader.load({ patch: '16.21', champion: 'Nunu & Willump', role: 'Jungle', keystone: 8010 });
    expect(urls[0]).toBe('https://lolalytics.com/lol/nunu/build/?lane=jungle&tier=emerald_plus&region=all&keystone=8010');
  });

  it('identifiants d’URL du snapshot pris tels quels, validés', async () => {
    const { urls, loader } = await setup(async () => new Response(page(50, 100)));
    await loader.load({ ...vs, champion: 'Wukong', slug: 'monkeyking', opponentSlug: 'drmundo', opponent: 'Dr. Mundo' });
    expect(urls[0]).toBe('https://lolalytics.com/lol/monkeyking/vs/drmundo/build/?lane=top&vslane=top&tier=emerald_plus');
    expect(BuildRequestSchema.safeParse({ ...vs, slug: '../x' }).success).toBe(false);
  });

  it('build gardé d’un autre format de lecture : rechargé', async () => {
    const { dir, urls, loader } = await setup(async () => new Response(page(50, 100)));
    await loader.load(vs);
    const [file] = await readdir(join(dir, '16.21'));
    const path = join(dir, '16.21', file!);
    await writeFile(path, JSON.stringify({ ...JSON.parse(await readFile(path, 'utf8')), format: 1 }));
    await loader.load(vs);
    expect(urls).toHaveLength(2);
  });

  it('hors ligne : échec immédiat, sans requête', async () => {
    const { urls, loader } = await setup(async () => new Response(page(50, 1)), false);
    expect(await loader.load(vs)).toEqual({ ok: false, error: 'OFFLINE' });
    expect(urls).toHaveLength(0);
  });

  it('Lolalytics ne répond pas : délai dépassé ou erreur du serveur', async () => {
    expect(await (await setup(() => Promise.reject(new Error('timeout')))).loader.load(vs)).toEqual({ ok: false, error: 'DOWN' });
    expect(await (await setup(async () => new Response('', { status: 503 }))).loader.load(vs)).toEqual({ ok: false, error: 'DOWN' });
  });

  it('page non reconnue : format changé ou adresse inconnue, rien en cache', async () => {
    const { urls, loader } = await setup(async () => new Response('<html>nouveau site</html>'));
    expect(await loader.load(vs)).toEqual({ ok: false, error: 'FORMAT' });
    expect(await loader.load(vs)).toEqual({ ok: false, error: 'FORMAT' });
    expect(urls).toHaveLength(2);
    expect(await (await setup(async () => new Response('', { status: 404 }))).loader.load(vs)).toEqual({ ok: false, error: 'FORMAT' });
  });

  it('rétention : autres patchs supprimés, champions des pools gardés, les autres 14 jours après leur ouverture', async () => {
    const { dir, loader } = await setup(async () => new Response(page(50, 100)));
    await loader.load(vs);
    await loader.load({ ...vs, champion: 'Garen' });
    await loader.load({ ...vs, champion: 'Fiora' });
    await mkdir(join(dir, '16.20'));
    await writeFile(join(dir, '16.20', 'x.json'), '{}');
    const old = new Date(Date.now() - RETENTION_MS - 60_000);
    const files = await readdir(join(dir, '16.21'));
    // Garen et Aatrox ouverts il y a plus de 14 jours, Fiora récemment.
    for (const f of files) {
      const text = await readFile(join(dir, '16.21', f), 'utf8');
      if (!text.includes('"Fiora"')) await utimes(join(dir, '16.21', f), old, old);
    }
    await loader.prune('16.21', ['Aatrox']);
    expect(await readdir(dir)).toEqual(['16.21']);
    const left = await Promise.all((await readdir(join(dir, '16.21'))).map((f) => readFile(join(dir, '16.21', f), 'utf8')));
    expect(left.map((t) => (JSON.parse(t) as { champion: string }).champion).sort()).toEqual(['Aatrox', 'Fiora']);
  });
});
