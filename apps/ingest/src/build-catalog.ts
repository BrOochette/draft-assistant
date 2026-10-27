import { access, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BuildCatalogSchema, type BuildCatalog, type ItemTag } from '@draft/schemas';

// Objets, runes et sorts d'invocateur depuis Data Dragon (en français), avec leurs icônes : fournis avec l'appli pour
// afficher les builds sans appel réseau pendant une draft.

const CDN = 'https://ddragon.leagueoflegends.com/cdn/';
/** Portée d'attaque à partir de laquelle un champion est à distance. */
const RANGED_FROM = 300;

/** Fragments de runes : absents de Data Dragon. */
const SHARDS: Record<number, string> = {
  5001: 'PV croissants',
  5005: "Vitesse d'attaque",
  5007: 'Accélération de compétence',
  5008: 'Force adaptative',
  5010: 'Vitesse de déplacement',
  5011: 'PV',
  5013: 'Ténacité et résistance aux ralentissements'
};

export interface DdItem {
  name: string;
  description: string;
  tags?: string[];
  maps?: Record<string, boolean>;
  gold?: { purchasable?: boolean };
  stats?: Record<string, number>;
}

/**
 * Étiquettes d'un objet, d'après ses stats et sa description en français :
 * - mr, armor : résistance magique, armure ;
 * - antiheal : applique Hémorragie ;
 * - antitank : pénétration, létalité, réduction d'armure ou dégâts selon les PV de la cible.
 */
export const itemTags = (item: DdItem): ItemTag[] => {
  const text = item.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const tags: ItemTag[] = [];
  if (item.tags?.includes('Boots')) tags.push('boots');
  if ((item.stats?.FlatSpellBlockMod ?? 0) > 0) tags.push('mr');
  if ((item.stats?.FlatArmorMod ?? 0) > 0) tags.push('armor');
  if (/Hémorragie/i.test(text)) tags.push('antiheal');
  if (/pénétration|létalité|réduit leur armure|de leurs PV (max|bonus)|PV actuels de l'ennemi/i.test(text)) tags.push('antitank');
  return tags;
};

interface DdRuneTree {
  id: number;
  name: string;
  icon: string;
  slots: { runes: { id: number; name: string; icon: string }[] }[];
}

const exists = (path: string) => access(path).then(() => true, () => false);
const getJson = async (url: string): Promise<unknown> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Data Dragon : ${res.status} sur ${url}`);
  return res.json();
};

/**
 * Télécharge le catalogue des builds pour une version de Data Dragon et les icônes manquantes dans `iconDir`
 * (item/<id>.png, rune/<id>.png, tree/<id>.png, spell/<clé>.png). Renvoie le catalogue et le nombre d'icônes téléchargées.
 */
export const downloadBuildCatalog = async (version: string, iconDir: string): Promise<{ catalog: BuildCatalog; fetched: number; failed: string[] }> => {
  const data = CDN + version + '/data/fr_FR/';
  const items = ((await getJson(data + 'item.json')) as { data: Record<string, DdItem> }).data;
  const trees = (await getJson(data + 'runesReforged.json')) as DdRuneTree[];
  const spells = ((await getJson(data + 'summoner.json')) as { data: Record<string, { key: string; name: string; modes: string[]; image: { full: string } }> }).data;
  const champions = ((await getJson(data + 'champion.json')) as { data: Record<string, { name: string; id: string; stats: { attackrange: number } }> }).data;

  const icons: { path: string; url: string }[] = [];
  const catalog: BuildCatalog = { version, items: {}, runes: {}, trees: {}, spells: {}, ranged: [] };
  for (const [id, item] of Object.entries(items)) {
    // Faille de l'invocateur, achetable ; les variantes d'autres modes ont des identifiants à 6 chiffres.
    if (!item.maps?.['11'] || !item.gold?.purchasable || Number(id) >= 100000) continue;
    catalog.items[id] = { name: item.name, tags: itemTags(item) };
    icons.push({ path: `item/${id}.png`, url: `${CDN}${version}/img/item/${id}.png` });
  }
  for (const t of trees) {
    catalog.trees[t.id] = { name: t.name };
    icons.push({ path: `tree/${t.id}.png`, url: `${CDN}img/${t.icon}` });
    for (const slot of t.slots)
      for (const r of slot.runes) {
        catalog.runes[r.id] = { name: r.name, tree: t.id };
        icons.push({ path: `rune/${r.id}.png`, url: `${CDN}img/${r.icon}` });
      }
  }
  for (const [id, name] of Object.entries(SHARDS)) catalog.runes[id] = { name };
  for (const s of Object.values(spells)) {
    if (!s.modes.includes('CLASSIC')) continue;
    catalog.spells[s.key] = { name: s.name };
    icons.push({ path: `spell/${s.key}.png`, url: `${CDN}${version}/img/spell/${s.image.full}` });
  }
  catalog.ranged = Object.values(champions).filter((c) => c.stats.attackrange >= RANGED_FROM).map((c) => c.id).sort();

  let fetched = 0;
  const failed: string[] = [];
  for (const icon of icons) {
    const file = join(iconDir, icon.path);
    if (await exists(file)) continue;
    await mkdir(join(file, '..'), { recursive: true });
    const res = await fetch(icon.url);
    if (!res.ok) {
      failed.push(icon.path);
      continue;
    }
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
    fetched++;
  }
  return { catalog: BuildCatalogSchema.parse(catalog), fetched, failed };
};
