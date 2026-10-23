import {
  normalizeChampion,
  type BanSuggestion,
  type Candidate,
  type Champion,
  type MatchupNotes,
  type Role,
  type StatsSnapshot
} from '@draft/schemas';

/** Source des stats lue par le moteur. Changer de source ne touche pas au moteur. */
export interface StatsProvider {
  /** Champions recommandables sur un rôle, dans l'ordre de la source. */
  listCandidates(role: Role): readonly Candidate[];
  /** Stats d'un champion sur un rôle. Toujours une valeur, au besoin une valeur par défaut. */
  getRoleStats(champion: string, role: Role): Candidate;
}

/** Tout ce que le moteur lit en plus de l'état de la draft et des pools. */
export interface EngineData {
  stats: StatsProvider;
  /** Catalogue normalisé, par nom. */
  catalog: ReadonlyMap<string, Champion>;
  matchupNotes: MatchupNotes;
  banSuggestions: readonly BanSuggestion[];
  /** Lissage du win rate des candidats vers 50 % (parties fictives), 0 sans lissage. */
  winRatePriorGames: number;
}

const FALLBACK = { games: 3000, synergyBase: 55, laneWinRate: 50, gameWinRate: 50 };

export class SnapshotStatsProvider implements StatsProvider {
  private readonly byRole = new Map<Role, Map<string, Candidate>>();

  constructor(
    private readonly candidates: StatsSnapshot['candidates'],
    private readonly catalog: ReadonlyMap<string, Champion>
  ) {
    for (const [role, list] of Object.entries(candidates) as [Role, Candidate[]][]) {
      this.byRole.set(role, new Map(list.map((c) => [c.name, c])));
    }
  }

  listCandidates(role: Role): readonly Candidate[] {
    return this.candidates[role] ?? [];
  }

  getRoleStats(champion: string, role: Role): Candidate {
    const found = this.byRole.get(role)?.get(champion);
    if (found) return found;
    // Valeur par défaut de la maquette pour un pick sans stats (saisie manuelle).
    const m = this.catalog.get(champion);
    return {
      name: champion,
      ...FALLBACK,
      scaling: m ? m.scaling : [3, 3, 3],
      provides: m ? m.provides : [],
      damage: m ? m.damage : 'AD',
      notes: []
    };
  }
}

export const createEngineData = (snapshot: StatsSnapshot): EngineData => {
  const catalog = new Map<string, Champion>();
  for (const c of snapshot.champions) if (!catalog.has(c.name)) catalog.set(c.name, normalizeChampion(c));
  return {
    stats: new SnapshotStatsProvider(snapshot.candidates, catalog),
    catalog,
    matchupNotes: snapshot.matchupNotes,
    winRatePriorGames: snapshot.winRatePriorGames ?? 0,
    banSuggestions: snapshot.banSuggestions
  };
};
