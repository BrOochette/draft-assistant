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
  enemyTeam: [{ opponent: 'Leona', role: 'Support', winRate: 47.5, games: 1419, delta: -2.7, weight: 0.75 }]
} as unknown as Evaluation;

afterEach(() => vi.useRealTimers());

describe('fenêtre flottante du matchup', () => {
  it('affiche un loader de 0,3 s avant le détail', () => {
    vi.useFakeTimers();
    render(
      <DataContext.Provider value={sampleAppData()}>
        <WinRateChips e={e} />
      </DataContext.Provider>
    );
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'vs Jinx 54,9 %' }));
    expect(screen.getByRole('status', { name: 'Chargement' })).toBeInTheDocument();
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
