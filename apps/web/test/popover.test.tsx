import { act, fireEvent, render, screen } from '@testing-library/react';
import type { EnemyEffect, Evaluation } from '@draft/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataContext, POPOVER_LOADER_MS, WinRateChips } from '../src/ui';
import { sampleAppData } from './fixtures';

const jinx: EnemyEffect = { opponent: 'Jinx', role: 'ADC', lane: true, weight: 1, winRate: 54.9, games: 3115, prior: null, delta: 2.2 };
const leona: EnemyEffect = { opponent: 'Leona', role: 'Support', lane: false, weight: 0.75, winRate: 47.5, games: 1419, prior: null, delta: -2.7 };
const e = {
  champion: 'Twitch',
  laneWinRate: null,
  gameWinRate: 51,
  matchup: jinx,
  enemyTeam: [jinx, leona],
  allyTeam: [],
  expected: { base: 51, matchups: 0.175, duos: 0, mastery: 0, score: 51.175 }
} as unknown as Evaluation;

const renderChips = (ev: Evaluation = e) =>
  render(
    <DataContext.Provider value={sampleAppData()}>
      <WinRateChips e={ev} />
    </DataContext.Provider>
  );

afterEach(() => vi.useRealTimers());

describe('fenêtre flottante des ennemis', () => {
  it('affiche un seul chip de win rate', () => {
    renderChips();
    expect(screen.getByText('WR 51,0 %')).toBeInTheDocument();
    expect(screen.queryByText(/Lane/)).not.toBeInTheDocument();
  });

  it('affiche un loader de 0,3 s sous la souris avant le détail', () => {
    vi.useFakeTimers();
    renderChips();
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'vs Jinx 54,9 %' }), { clientX: 200, clientY: 100 });
    const loader = screen.getByRole('status', { name: 'Chargement' });
    expect(loader.style.left).toBe('212px');
    expect(loader.style.top).toBe('112px');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(POPOVER_LOADER_MS - 1));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    const panel = screen.getByRole('group', { name: 'Effet des ennemis sur le win rate attendu de Twitch' });
    expect(panel).toHaveTextContent('Vis-à-vis');
    expect(panel).toHaveTextContent('3 115 parties');
    expect(panel).toHaveTextContent('×3/4');
  });

  it('annule le chargement si la souris quitte le chip', () => {
    vi.useFakeTimers();
    renderChips();
    const chip = screen.getByRole('button', { name: 'vs Jinx 54,9 %' });
    fireEvent.mouseEnter(chip);
    fireEvent.mouseLeave(chip);
    act(() => vi.advanceTimersByTime(POPOVER_LOADER_MS));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('montre la moyenne de classe pour un ennemi sans données', () => {
    const amumu: EnemyEffect = {
      opponent: 'Amumu', role: 'Jungle', lane: false, weight: 0.25, winRate: null, games: 0,
      prior: { classes: ['Marksman', 'Vanguard'], delta: -0.5, games: 9000 }, delta: -0.5
    };
    renderChips({ ...e, enemyTeam: [jinx, amumu, leona] } as Evaluation);
    fireEvent.click(screen.getByRole('button', { name: 'vs Jinx 54,9 %' }), { detail: 1 });
    const rows = screen.getAllByRole('row').map((r) => r.textContent!);
    expect(rows.slice(1).map((t) => t.match(/Jinx|Amumu|Leona/)![0])).toEqual(['Jinx', 'Amumu', 'Leona']);
    expect(rows[2]).toContain('Pas de données');
    expect(rows[2]).toContain('Moyenne Marksman contre Vanguard -0,5');
  });

  it('après le survol, le clic garde la fenêtre et saute le loader ; un second clic la ferme', () => {
    vi.useFakeTimers();
    renderChips();
    const chip = screen.getByRole('button', { name: 'vs Jinx 54,9 %' });
    expect(chip).not.toHaveAttribute('title');
    fireEvent.mouseEnter(chip, { clientX: 10, clientY: 10 });
    fireEvent.click(chip, { detail: 1 });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Effet des ennemis sur le win rate attendu de Twitch' })).toBeInTheDocument();
    fireEvent.click(chip, { detail: 1 });
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('se ferme avec Échap', () => {
    renderChips();
    fireEvent.click(screen.getByRole('button', { name: 'vs Jinx 54,9 %' }), { detail: 1 });
    expect(screen.getByRole('group')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });
});

describe('fenêtre flottante des alliés', () => {
  it('montre le duo avec chaque allié verrouillé et son effet sur le win rate attendu', () => {
    const withAllies = {
      ...e,
      allyTeam: [{ ally: 'Sejuani', role: 'Jungle', weight: 0.5, raw: 2.5, games: 1800, prior: null, delta: 2.25 }]
    } as unknown as Evaluation;
    renderChips(withAllies);
    // 0,5 × 2,25 = 1,125 point.
    fireEvent.click(screen.getByRole('button', { name: 'avec Sejuani +1,1 pts' }), { detail: 1 });
    const panel = screen.getByRole('group', { name: 'Effet des alliés sur le win rate attendu de Twitch' });
    expect(panel).toHaveTextContent('1 800 parties');
    expect(panel).toHaveTextContent('×1/2');
    expect(panel).toHaveTextContent('+1,1');
  });
});
