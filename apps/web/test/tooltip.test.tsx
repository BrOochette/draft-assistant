import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TooltipLayer } from '../src/ui';

afterEach(() => vi.useRealTimers());

describe('infobulles maison', () => {
  it('remplace le title natif par une infobulle après le délai, et la ferme en sortant', () => {
    vi.useFakeTimers();
    render(
      <>
        <TooltipLayer />
        <div title="Parent">
          <button type="button" title="Win rate de partie">WR 52,8 %</button>
        </div>
      </>
    );
    const button = screen.getByRole('button', { name: 'WR 52,8 %' });
    fireEvent.pointerOver(button);
    // Plus aucun title : le navigateur n'affiche rien, ni pour le bouton ni pour son parent.
    expect(button).not.toHaveAttribute('title');
    expect(button.parentElement).not.toHaveAttribute('title');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Win rate de partie');
    fireEvent.pointerOut(button, { relatedTarget: document.body });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('un bouton sans texte garde son titre comme nom accessible', () => {
    render(
      <>
        <TooltipLayer />
        <button type="button" title="Retirer Sejuani" />
      </>
    );
    fireEvent.pointerOver(screen.getByRole('button'));
    expect(screen.getByRole('button', { name: 'Retirer Sejuani' })).toHaveAttribute('data-tip', 'Retirer Sejuani');
  });
});
