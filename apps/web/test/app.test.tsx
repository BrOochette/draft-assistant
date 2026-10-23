import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { seedPools } from '../src/data';
import { loadPools } from '../src/store';
import { sampleAppData } from './fixtures';

const jungleRecs = () =>
  within(screen.getByRole('region', { name: 'Rôle Jungle' }))
    .getAllByRole('button', { pressed: false })
    .map((b) => b.getAttribute('aria-label') ?? '')
    .filter((l) => l.includes('score'));

describe('écran Draft', () => {
  it('verrouille Sejuani puis annule', async () => {
    const user = userEvent.setup();
    render(<App initialData={sampleAppData()} initialPools={seedPools()} />);
    expect(screen.getByTestId('compo-score')).toHaveTextContent('29');
    expect(screen.getByTestId('compo-verdict')).toHaveTextContent('À corriger');

    await user.click(screen.getByRole('button', { name: 'Sejuani, score 74 sur 100. Sélectionner.' }));
    await user.click(screen.getByRole('button', { name: 'Verrouiller Sejuani en Jungle' }));
    expect(screen.getByTestId('compo-score')).toHaveTextContent('68');
    expect(screen.getByTestId('compo-verdict')).toHaveTextContent('Correcte');
    expect(screen.getByRole('status')).toHaveTextContent('Sejuani verrouillé en Jungle');

    await user.click(within(screen.getByRole('status')).getByRole('button', { name: 'Annuler' }));
    expect(screen.getByTestId('compo-score')).toHaveTextContent('29');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('un ban ennemi retire le champion des recommandations', async () => {
    const user = userEvent.setup();
    render(<App initialData={sampleAppData()} initialPools={seedPools()} />);
    expect(jungleRecs()[0]).toMatch(/^Sejuani/);

    await user.click(screen.getAllByRole('button', { name: "Saisir un ban de l'équipe ennemie" })[0]!);
    await user.type(screen.getByRole('textbox', { name: 'Rechercher un champion' }), 'sej');
    await user.click(screen.getByRole('button', { name: 'Bannir Sejuani' }));

    expect(screen.getByRole('button', { name: 'Retirer le ban de Sejuani' })).toBeInTheDocument();
    expect(jungleRecs().map((l) => l.split(',')[0])).toEqual(['Fiddlesticks', 'Viego', 'Lee Sin']);
  });

  it('saisit un pick ennemi à la main', async () => {
    const user = userEvent.setup();
    render(<App initialData={sampleAppData()} initialPools={seedPools()} />);
    const opener = screen.getByRole('button', { name: 'Saisie manuelle : pick ennemi en ADC' });
    await user.click(opener);
    expect(screen.getByRole('dialog', { name: 'Pick ennemi en ADC' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();

    await user.click(opener);
    expect(screen.getByRole('button', { name: 'Jhin, indisponible : Banni' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Saisir Jinx en ADC' }));
    expect(screen.getByRole('status')).toHaveTextContent('Pick ennemi en ADC : Jinx');
  });
});

describe('écran Joueurs', () => {
  it('enregistre une modification de pool dans IndexedDB', async () => {
    const user = userEvent.setup();
    location.hash = '#/joueurs';
    render(<App initialData={sampleAppData()} />);
    await user.click(await screen.findByRole('button', { name: /^Noa/ }));
    await user.click(screen.getByRole('button', { name: /^Mid/ }));
    await user.click(screen.getByRole('button', { name: 'Baisser la maîtrise de Lux' }));
    expect(within(screen.getByRole('button', { name: 'Baisser la maîtrise de Lux' }).closest('li')!).getByText('8/10')).toBeInTheDocument();

    await waitFor(async () => {
      const lux = (await loadPools()).Noa?.Mid?.find((p) => p.champion === 'Lux');
      expect(lux?.mastery).toBe(8);
    });
  });
});
