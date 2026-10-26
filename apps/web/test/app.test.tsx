import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { seedPools } from '../src/data';
import { loadPools } from '../src/store';
import { sampleAppData } from './fixtures';

// Cartes du pool du rôle Jungle (vue client), dans l'ordre.
const jungleRecs = () =>
  within(screen.getByRole('region', { name: 'Rôle Jungle' }))
    .queryAllByRole('article')
    .map((b) => b.getAttribute('aria-label') ?? '');

const compo = (side: 'ally' | 'enemy') => {
  const card = within(screen.getByTestId(side + '-compo'));
  return { score: card.getByTestId('compo-score').textContent, verdict: card.getByTestId('compo-verdict').textContent };
};

describe('écran Draft', () => {
  it('verrouille Sejuani puis la retire', async () => {
    const user = userEvent.setup();
    render(<App initialData={sampleAppData()} initialPools={seedPools()} />);
    expect(compo('ally')).toEqual({ score: '29/100', verdict: 'À corriger' });
    expect(compo('enemy')).toEqual({ score: '69/100', verdict: 'Correcte' });
    // Top (Aurora) est verrouillé dans l'état de départ : le centre montre le premier rôle ouvert, la Jungle.
    expect(jungleRecs()[0]).toBe('Sejuani, 14,8 sur 20');

    await user.click(screen.getByRole('button', { name: 'Verrouiller Sejuani en Jungle' }));
    expect(compo('ally')).toEqual({ score: '68/100', verdict: 'Correcte' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retirer Sejuani et rouvrir les suggestions en Jungle' }));
    expect(compo('ally').score).toBe('29/100');
  });

  it('un ban ennemi retire le champion des recommandations', async () => {
    const user = userEvent.setup();
    render(<App initialData={sampleAppData()} initialPools={seedPools()} />);
    expect(jungleRecs()[0]).toMatch(/^Sejuani/);

    await user.click(screen.getAllByRole('button', { name: "Saisir un ban de l'équipe ennemie" })[0]!);
    await user.type(screen.getByRole('textbox', { name: 'Rechercher un champion' }), 'sej');
    await user.click(screen.getByRole('button', { name: 'Bannir Sejuani' }));

    expect(screen.getByRole('button', { name: 'Retirer le ban de Sejuani' })).toBeInTheDocument();
    expect(jungleRecs().map((l) => l.split(',')[0]).slice(0, 3)).toEqual(['Fiddlesticks', 'Viego', 'Lee Sin']);
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
    expect(screen.getByRole('button', { name: 'Retirer le pick ennemi Jinx en ADC' })).toBeInTheDocument();
    expect(compo('enemy').score).not.toBe('69/100');

    // La croix retire le pick ennemi.
    await user.click(screen.getByRole('button', { name: 'Retirer le pick ennemi Jinx en ADC' }));
    expect(screen.queryByRole('button', { name: 'Retirer le pick ennemi Jinx en ADC' })).not.toBeInTheDocument();
    expect(compo('enemy').score).toBe('69/100');
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

    // À la souris : un clic sur la ligne place le champion sur son rôle mis en avant.
    await user.type(screen.getByRole('combobox', { name: 'Saisie rapide : pick allié' }), 'orianna');
    await user.click(screen.getByRole('option', { name: 'Orianna en Mid' }));
    expect(screen.getByRole('button', { name: 'Retirer Orianna et rouvrir les suggestions en Mid' })).toBeInTheDocument();
  });
});

describe('écran Draft sur grand écran', () => {
  it('choisit un rôle, ouvre le choix manuel et verrouille depuis le rôle choisi', async () => {
    // Fenêtre d'au moins 1200 px : jsdom n'a pas matchMedia, on le simule.
    const mq = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    vi.stubGlobal('matchMedia', vi.fn(() => mq));
    try {
      const user = userEvent.setup();
      render(<App initialData={sampleAppData()} initialPools={seedPools()} />);
      // Top (Aurora) est verrouillé dans l'état de départ : le centre montre le premier rôle ouvert, la Jungle.
      expect(screen.getByRole('region', { name: 'Rôle Jungle' })).toBeInTheDocument();
      // Un clic sur la carte d'un allié affiche les suggestions de son rôle, sans ouvrir la fenêtre de choix.
      await user.click(screen.getAllByRole('button', { name: 'Suggestions en Mid' })[0]!);
      expect(screen.getByRole('region', { name: 'Rôle Mid' })).toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      // Le bouton « Choix manuel » ouvre la fenêtre de choix du rôle affiché.
      await user.click(screen.getByRole('button', { name: 'Choix manuel du champion en Mid' }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      await user.keyboard('{Escape}');
      await user.click(screen.getAllByRole('button', { name: 'Suggestions en Jungle' })[0]!);
      await user.click(screen.getByRole('button', { name: 'Verrouiller Sejuani en Jungle' }));
      expect(screen.getByRole('button', { name: 'Retirer Sejuani et rouvrir les suggestions en Jungle' })).toBeInTheDocument();
      // Les mentions légales restent sous la draft.
      expect(screen.getByRole('contentinfo', { name: 'Mentions' })).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
    }
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
    await user.click(await screen.findByRole('combobox', { name: 'Joueur en ADC : aucun' }));
    expect(screen.getByRole('option', { name: /Aucun joueur/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('option', { name: /Lou/ })).not.toBeInTheDocument();
  });

  it('change le type de suggestion d’un rôle', async () => {
    const user = userEvent.setup();
    render(<App initialData={sampleAppData()} initialPools={seedPools()} />);
    await user.click(screen.getAllByRole('button', { name: 'Suggestions en Mid' })[0]!);
    expect(screen.getByRole('button', { name: 'Mix en Mid' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Synergie en Mid' }));
    expect(screen.getByRole('button', { name: 'Synergie en Mid' })).toHaveAttribute('aria-pressed', 'true');
    // Synergie 82 et maîtrise 80 : 0,75 × 82 + 0,25 × 80 = 81,5, arrondi à 82 sur 100, soit 16,4 sur 20.
    expect(screen.getByRole('article', { name: /^Orianna, 16,4 sur 20/ })).toBeInTheDocument();
    const saved = JSON.parse(localStorage.getItem('draft-assistant:suggestion-modes')!);
    expect(saved.Mid).toBe('synergy');
    expect(saved.Jungle).toBe('mix');
  });

  it('cherche un champion hors pool dans le rôle choisi', async () => {
    const user = userEvent.setup();
    render(<App initialData={sampleAppData()} initialPools={seedPools()} />);
    const jungle = within(screen.getByRole('region', { name: 'Rôle Jungle' }));
    const search = jungle.getByRole('searchbox', { name: 'Rechercher un champion dans la liste Jungle' });
    await user.type(search, 'zzz');
    expect(jungle.getByText('Aucun champion trouvé.')).toBeInTheDocument();
  });

  it('permet de ne placer aucun joueur sur un rôle', async () => {
    const user = userEvent.setup();
    render(<App initialData={sampleAppData()} initialPools={seedPools()} />);
    await user.click(screen.getByRole('combobox', { name: /^Joueur en Mid/ }));
    // Chaque joueur est proposé ; celui déjà placé sur un autre rôle porte ce rôle.
    expect(screen.getByRole('option', { name: /^Alex/ })).toHaveTextContent('Top');
    await user.click(screen.getByRole('option', { name: /Aucun joueur/ }));
    expect(screen.getByRole('combobox', { name: 'Joueur en Mid : aucun' })).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    // Sans joueur, pas de liste hors pool : tous les champions du rôle sont proposés.
    await user.click(screen.getAllByRole('button', { name: 'Suggestions en Mid' })[0]!);
    expect(within(screen.getByRole('region', { name: 'Rôle Mid' })).queryByText(/Hors pool/i)).not.toBeInTheDocument();
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
