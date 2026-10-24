import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Evaluation } from '@draft/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataContext, POPOVER_LOADER_MS, WinRateChips } from '../src/ui';
import { sampleAppData } from './fixtures';

const e = {
  champion: 'Twitch',
  laneWinRate: null,
  gameWinRate: 51,
  matchup: { opponent: 'Jinx', winRate: 54.9, games: 3115, delta: 2.2 },
  allyTeam: [],
  enemyNoData: [],
  duoBonus: 0,
  enemyTeam: [{ opponent: 'Leona', role: 'Support', winRate: 47.5, games: 1419, delta: -2.7, weight: 0.75 }]
} as unknown as Evaluation;

afterEach(() => vi.useRealTimers());

describe('fenêtre flottante du matchup', () => {
  it('affiche un seul chip de win rate', () => {
    render(
      <DataContext.Provider value={sampleAppData()}>
        <WinRateChips e={e} />
      </DataContext.Provider>
    );
    expect(screen.getByText('WR 51,0 %')).toBeInTheDocument();
    expect(screen.queryByText(/Lane/)).not.toBeInTheDocument();
  });

  it('affiche un loader de 0,3 s sous la souris avant le détail', () => {
    vi.useFakeTimers();
    render(
      <DataContext.Provider value={sampleAppData()}>
        <WinRateChips e={e} />
      </DataContext.Provider>
    );
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'vs Jinx 54,9 %' }), { clientX: 200, clientY: 100 });
    const loader = screen.getByRole('status', { name: 'Chargement' });
    expect(loader.style.left).toBe('212px');
    expect(loader.style.top).toBe('112px');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(POPOVER_LOADER_MS - 1));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Effet des ennemis sur le counter de Twitch' })).toBeInTheDocument();
    expect(screen.getByText('Vis-à-vis')).toBeInTheDocument();
  });

  it('annule le chargement si la souris quitte le chip', () => {
    vi.useFakeTimers();
    render(
      <DataContext.Provider value={sampleAppData()}>
        <WinRateChips e={e} />
      </DataContext.Provider>
    );
    const chip = screen.getByRole('button', { name: 'vs Jinx 54,9 %' });
    fireEvent.mouseEnter(chip);
    fireEvent.mouseLeave(chip);
    act(() => vi.advanceTimersByTime(POPOVER_LOADER_MS));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });
});

describe('fenêtre flottante des alliés', () => {
  it('montre le duo avec chaque allié verrouillé et son effet sur la synergie', () => {
    vi.useFakeTimers();
    const withAllies = { ...e, allyTeam: [{ ally: 'Sejuani', role: 'Jungle', delta: 2.5, games: 1800, smoothed: 2.25 }], duoBonus: 9 } as unknown as Evaluation;
    render(
      <DataContext.Provider value={sampleAppData()}>
        <WinRateChips e={withAllies} />
      </DataContext.Provider>
    );
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'avec Sejuani +9 pts de synergie' }), { clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(POPOVER_LOADER_MS));
    const panel = screen.getByRole('group', { name: 'Effet des alliés sur la synergie de Twitch' });
    expect(panel).toHaveTextContent('Sejuani');
    expect(panel).toHaveTextContent('1 800 parties');
    expect(panel).toHaveTextContent('×4');
    expect(panel).toHaveTextContent('+9,0');
  });
});

describe('ennemis sans assez de parties', () => {
  it('les liste avec un effet nul', () => {
    vi.useFakeTimers();
    const withNoData = { ...e, enemyNoData: [{ opponent: 'Amumu', role: 'Jungle', lane: false, games: null }] } as unknown as Evaluation;
    render(
      <DataContext.Provider value={sampleAppData()}>
        <WinRateChips e={withNoData} />
      </DataContext.Provider>
    );
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'vs Jinx 54,9 %' }), { clientX: 10, clientY: 10 });
    act(() => vi.advanceTimersByTime(POPOVER_LOADER_MS));
    const rows = screen.getAllByRole('row').map((r) => r.textContent);
    // Vis-à-vis, puis Jungle (Amumu), puis Support (Leona).
    expect(rows.slice(1).map((t) => t!.match(/Jinx|Amumu|Leona/)![0])).toEqual(['Jinx', 'Amumu', 'Leona']);
    expect(screen.getByText('Pas assez de parties')).toBeInTheDocument();
    expect(screen.getByText('Paire absente des données')).toBeInTheDocument();
  });
});

describe('clic sur le chip', () => {
  it('après le survol, le clic garde la fenêtre et saute le loader ; un second clic la ferme', () => {
    vi.useFakeTimers();
    render(
      <DataContext.Provider value={sampleAppData()}>
        <WinRateChips e={e} />
      </DataContext.Provider>
    );
    const chip = screen.getByRole('button', { name: 'vs Jinx 54,9 %' });
    expect(chip).not.toHaveAttribute('title');
    fireEvent.mouseEnter(chip, { clientX: 10, clientY: 10 });
    fireEvent.click(chip, { detail: 1 });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Effet des ennemis sur le counter de Twitch' })).toBeInTheDocument();
    fireEvent.click(chip, { detail: 1 });
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });
});
