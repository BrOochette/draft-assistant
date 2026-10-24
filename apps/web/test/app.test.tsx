import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { seedPools } from '../src/data';
import { loadPools } from '../src/store';
import { sampleAppData } from './fixtures';

const jungleRecs = () =>
  within(screen.getByRole('region', { name: 'Rôle Jungle' }))
    .queryAllByRole('group')
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

    // Un clic sur la card la présélectionne sans la verrouiller.
    await user.click(screen.getByRole('group', { name: 'Sejuani, score 74 sur 100' }));
    expect(screen.getByRole('group', { name: 'Sejuani, score 74 sur 100, présélectionné' })).toBeInTheDocument();
    expect(compo('ally').score).toBe('29');

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

  it('saisit des picks au clavier avec la saisie rapide', async () => {
    const user = userEvent.setup();
    render(<App initialData={sampleAppData()} initialPools={seedPools()} />);
    // « / » place le curseur dans la saisie rapide, en mode ennemi par défaut.
    await user.keyboard('/');
    const input = screen.getByRole('combobox', { name: 'Saisie rapide : pick ennemi' });
    expect(input).toHaveFocus();
    // Zed est banni : proposé grisé, avec la raison.
    await user.type(input, 'zed');
    expect(screen.getByRole('option', { name: 'Zed, Banni' })).toHaveAttribute('aria-disabled', 'true');
    await user.clear(input);
    await user.type(input, 'amumu');
    expect(screen.getByRole('option', { name: 'Amumu en Jungle' })).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Retirer le pick ennemi Amumu en Jungle' })).toBeInTheDocument();
    expect(input).toHaveValue('');

    // Le camp reste choisi ; en allié, Entrée verrouille le pick sur son rôle.
    await user.click(screen.getByRole('button', { name: 'Allié' }));
    await user.type(screen.getByRole('combobox', { name: 'Saisie rapide : pick allié' }), 'sej');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Retirer Sejuani et rouvrir les suggestions en Jungle' })).toBeInTheDocument();
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
    expect(screen.getByRole('group', { name: /^Orianna, score 82 sur 100/ })).toBeInTheDocument();
    const saved = () => JSON.parse(localStorage.getItem('draft-assistant:suggestion-modes')!);
    expect(saved()).toEqual({ Top: 'synergy', Jungle: 'synergy', Mid: 'synergy', ADC: 'synergy', Support: 'synergy' });
    // Le sélecteur global a réglé chaque rôle.
    expect(screen.getByRole('button', { name: 'Synergie en Mid' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('change le type de suggestion pour un seul rôle', async () => {
    const user = userEvent.setup();
    render(<App initialData={sampleAppData()} initialPools={seedPools()} />);
    await user.click(screen.getByRole('button', { name: 'Synergie en Mid' }));
    expect(screen.getByRole('group', { name: /^Orianna, score 82 sur 100/ })).toBeInTheDocument();
    // Les autres rôles restent en mix : le sélecteur global n'est plus allumé.
    expect(screen.getByRole('button', { name: 'Mix en Jungle' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Mix' })).toHaveAttribute('aria-pressed', 'false');
    expect(JSON.parse(localStorage.getItem('draft-assistant:suggestion-modes')!).Mid).toBe('synergy');
  });

  it('bascule entre les 3 cards et la vue liste', async () => {
    const user = userEvent.setup();
    render(<App initialData={sampleAppData()} initialPools={seedPools()} />);
    const jungle = within(screen.getByRole('region', { name: 'Rôle Jungle' }));
    expect(jungleRecs()).toHaveLength(3);
    expect(jungle.queryByText('Pool', { selector: '.detail-head' })).not.toBeInTheDocument();

    expect(jungle.getByRole('button', { name: 'Vue top 3 en Jungle' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(jungle.getByRole('button', { name: 'Vue liste en Jungle' }));
    expect(jungle.getByRole('button', { name: 'Vue liste en Jungle' })).toHaveAttribute('aria-pressed', 'true');
    expect(jungle.queryAllByRole('group', { name: /score/ })).toHaveLength(0);
    expect(jungle.getByText('Pool', { selector: '.detail-head' })).toBeInTheDocument();
    expect(jungle.getByRole('button', { name: 'Verrouiller Sejuani en Jungle' })).toBeInTheDocument();

    const listed = () => jungle.getAllByRole('button', { name: /^Verrouiller .* en Jungle$/ }).length;
    expect(listed()).toBeLessThanOrEqual(10);
    const more = jungle.queryByRole('button', { name: 'Voir plus de champions en Jungle' });
    if (more) {
      await user.click(more);
      expect(listed()).toBeGreaterThan(10);
    }

    // jsdom n'implémente pas le défilement.
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    await user.click(jungle.getByRole('button', { name: 'Remonter en haut du rôle Jungle' }));
    expect(scroll).toHaveBeenCalledOnce();
    expect(screen.getByRole('region', { name: 'Rôle Jungle' })).toHaveFocus();

    await user.type(jungle.getByRole('searchbox', { name: 'Rechercher un champion dans la liste Jungle' }), 'fid');
    expect(jungle.getAllByRole('button', { name: /^Verrouiller .* en Jungle$/ }).map((b) => b.getAttribute('aria-label'))).toEqual(['Verrouiller Fiddlesticks en Jungle']);
    await user.type(jungle.getByRole('searchbox', { name: 'Rechercher un champion dans la liste Jungle' }), 'zzz');
    expect(jungle.getByText('Aucun champion trouvé.')).toBeInTheDocument();

    await user.click(jungle.getByRole('button', { name: 'Vue top 3 en Jungle' }));
    expect(jungleRecs()).toHaveLength(3);
    expect(jungle.queryByText('Pool', { selector: '.detail-head' })).not.toBeInTheDocument();
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

  it('ajoute un champion au pool depuis la liste de recherche', async () => {
    const user = userEvent.setup();
    location.hash = '#/joueurs';
    render(<App initialData={sampleAppData()} />);
    await user.click(await screen.findByRole('button', { name: /^Noa/ }));
    await user.click(screen.getByRole('button', { name: /^Mid/ }));
    const input = screen.getByRole('combobox', { name: /Champion pour Noa, rôle Mid/ });
    await user.click(input);
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    // Lux est déjà dans le pool : elle n'est pas proposée.
    expect(options.map((o) => o.getAttribute('aria-label'))).not.toContain('Lux');
    const first = options[0]!.getAttribute('aria-label')!;
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'Retirer ' + first + ' du pool' })).toBeInTheDocument();
    expect(input).toHaveValue('');
  });
});
