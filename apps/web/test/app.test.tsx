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

const compo = (side: 'ally' | 'enemy') => {
  const card = within(screen.getByTestId(side + '-compo'));
  return { score: card.getByTestId('compo-score').textContent, verdict: card.getByTestId('compo-verdict').textContent };
};

describe('écran Draft', () => {
  it('verrouille Sejuani puis la retire', async () => {
    const user = userEvent.setup();
    render(<App initialData={sampleAppData()} initialPools={seedPools()} />);
    expect(compo('ally')).toEqual({ score: '29', verdict: 'À corriger' });
    expect(compo('enemy')).toEqual({ score: '69', verdict: 'Correcte' });

    await user.click(screen.getByRole('button', { name: 'Sejuani, score 74 sur 100. Sélectionner.' }));
    await user.click(screen.getByRole('button', { name: 'Verrouiller Sejuani en Jungle' }));
    expect(compo('ally')).toEqual({ score: '68', verdict: 'Correcte' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retirer Sejuani et rouvrir les suggestions en Jungle' }));
    expect(compo('ally').score).toBe('29');
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
    expect(screen.queryByRole('button', { name: 'Saisir Lux en ADC' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tous' }));
    expect(screen.getByRole('button', { name: 'Saisir Lux en ADC' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ahri, indisponible : Déjà pris' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'ADC' }));
    await user.click(screen.getByRole('button', { name: 'Saisir Jinx en ADC' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Rôle ADC' })).getByText('Jinx')).toBeInTheDocument();
    expect(compo('enemy').score).not.toBe('69');

    // La croix retire le pick ennemi.
    await user.click(screen.getByRole('button', { name: 'Retirer le pick ennemi Jinx en ADC' }));
    expect(within(screen.getByRole('region', { name: 'Rôle ADC' })).queryByText('Jinx')).not.toBeInTheDocument();
    expect(compo('enemy').score).toBe('69');
  });
});

describe('écran Joueurs', () => {
  it('supprime un joueur après confirmation', async () => {
    const user = userEvent.setup();
    location.hash = '#/joueurs';
    render(<App initialData={sampleAppData()} />);
    await user.click(await screen.findByRole('button', { name: /^Lou/ }));
    await user.click(screen.getByRole('button', { name: 'Supprimer le joueur' }));
    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.getByRole('button', { name: /^Lou/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Supprimer le joueur' }));
    expect(screen.getByRole('group', { name: 'Confirmer la suppression de Lou' })).toHaveTextContent('Supprimer Lou et ses pools ?');
    await user.click(screen.getByRole('button', { name: 'Oui, supprimer' }));
    expect(screen.queryByRole('button', { name: /^Lou/ })).not.toBeInTheDocument();
    await waitFor(async () => expect(Object.keys(await loadPools())).toEqual(['Alex', 'Sam', 'Noa', 'Max']));

    // Lou était placé en ADC : le rôle n'a plus de joueur dans la draft.
    await user.click(screen.getByRole('link', { name: 'Draft' }));
    const adc = within(await screen.findByRole('region', { name: 'Rôle ADC' }));
    expect(adc.getByRole('combobox', { name: 'Joueur' })).toHaveValue('');
    expect(adc.queryByText(/tous les champions sont classés/)).not.toBeInTheDocument();
    expect(adc.queryByRole('option', { name: 'Lou' })).not.toBeInTheDocument();
  });

  it('change le type de suggestion', async () => {
    const user = userEvent.setup();
    render(<App initialData={sampleAppData()} initialPools={seedPools()} />);
    expect(screen.getByRole('button', { name: 'Mix' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Meilleure synergie' }));
    expect(screen.getByRole('button', { name: 'Meilleure synergie' })).toHaveAttribute('aria-pressed', 'true');
    // Synergie 82 et maîtrise 80 : 0,75 × 82 + 0,25 × 80 = 81,5.
    expect(screen.getByRole('button', { name: /^Orianna, score 82 sur 100/ })).toBeInTheDocument();
    expect(localStorage.getItem('draft-assistant:suggestion-mode')).toBe('synergy');
  });

  it('permet de ne placer aucun joueur sur un rôle', async () => {
    const user = userEvent.setup();
    render(<App initialData={sampleAppData()} initialPools={seedPools()} />);
    const mid = within(screen.getByRole('region', { name: 'Rôle Mid' }));
    await user.selectOptions(mid.getByRole('combobox', { name: 'Joueur' }), 'Aucun joueur');
    expect(mid.getByText('Sans joueur : tous les champions')).toBeInTheDocument();
    expect(mid.queryByText(/Hors pool/)).not.toBeInTheDocument();
  });

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
