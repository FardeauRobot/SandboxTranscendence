// Déroulé d'un match à 2 joueurs, en pur TS : pourra tourner tel quel côté serveur.
//
// Une manche = une donne neuve pour chaque joueur. Chacun choisit, défausse et pose de son côté
// (en réseau, les deux en même temps ; sur un seul écran, l'interface les fait jouer l'un après l'autre).
// La manche est finie quand les deux ont posé. Les défausses sont un budget pour tout le match.
// Le temps n'est pas géré ici : c'est l'appelant qui envoie `timeout` quand le chrono d'un joueur expire.

import { createDeck, makeRng, shuffle } from './deck';
import { scoreHand } from './score';
import type { Card, Rules } from './types';

export type PlayerId = 0 | 1;
export const PLAYERS: readonly PlayerId[] = [0, 1];

export interface PlayerState {
  hand: Card[];
  drawPile: Card[];
  /** Ordre de sélection = ordre de pose (il compte pour les ×mult de famille). */
  selected: string[];
  /** Cumulé sur tout le match. */
  discardsUsed: number;
  /** Cartes posées dans la manche en cours ; null tant que le joueur n'a pas posé. */
  played: Card[] | null;
  /** Vrai si la pose vient de la fin du chrono. */
  timedOut: boolean;
  /** Score de chaque manche terminée par ce joueur (index = manche). */
  scores: number[];
  /** Règles au moment de la pose, pour le comparateur du labo. */
  rulesAtPlay: Rules | null;
}

export interface MatchState {
  seed: number;
  /** Manche en cours, à partir de 0. */
  round: number;
  players: [PlayerState, PlayerState];
}

export type MatchAction =
  | { type: 'new'; seed: number; rules: Rules }
  | { type: 'toggle'; p: PlayerId; id: string; max: number }
  | { type: 'discard'; p: PlayerId; rules: Rules }
  | { type: 'play'; p: PlayerId; rules: Rules }
  | { type: 'timeout'; p: PlayerId; rules: Rules }
  | { type: 'sort'; p: PlayerId; by: 'rank' | 'suit' }
  | { type: 'nextRound'; rules: Rules };

/** Donne reproductible : même seed → mêmes mains, manche par manche et joueur par joueur. */
function dealHand(seed: number, round: number, p: PlayerId, rules: Rules) {
  const deck = shuffle(createDeck(), makeRng((seed * 1009 + round * 31 + p * 7 + 1) >>> 0));
  const n = Math.max(1, Math.min(rules.game.handSize, deck.length));
  return { hand: deck.slice(0, n), drawPile: deck.slice(n) };
}

function freshPlayer(seed: number, p: PlayerId, rules: Rules): PlayerState {
  return {
    ...dealHand(seed, 0, p, rules),
    selected: [],
    discardsUsed: 0,
    played: null,
    timedOut: false,
    scores: [],
    rulesAtPlay: null,
  };
}

export function newMatch(seed: number, rules: Rules): MatchState {
  return { seed, round: 0, players: [freshPlayer(seed, 0, rules), freshPlayer(seed, 1, rules)] };
}

export function total(pl: PlayerState): number {
  return pl.scores.reduce((a, b) => a + b, 0);
}

/** La manche en cours est terminée quand les deux joueurs ont posé. */
export function roundDone(m: MatchState): boolean {
  return m.players.every((pl) => pl.played !== null);
}

export function matchOver(m: MatchState, rules: Rules): boolean {
  return roundDone(m) && m.round >= rules.game.rounds - 1;
}

/** Vainqueur au score cumulé ; null en cas d'égalité ou si le match n'est pas fini. */
export function winner(m: MatchState, rules: Rules): PlayerId | null {
  if (!matchOver(m, rules)) return null;
  const [a, b] = m.players.map(total);
  return a === b ? null : a > b ? 0 : 1;
}

const SUIT_ORDER = { coupes: 0, deniers: 1, epees: 2, batons: 3 } as const;

function setPlayer(m: MatchState, p: PlayerId, pl: PlayerState): MatchState {
  const players = m.players.slice() as [PlayerState, PlayerState];
  players[p] = pl;
  return { ...m, players };
}

function commit(pl: PlayerState, round: number, cards: Card[], rules: Rules, timedOut: boolean): PlayerState {
  const scores = pl.scores.slice();
  scores[round] = cards.length ? scoreHand(cards, rules).score : 0;
  return { ...pl, played: cards, selected: [], timedOut, scores, rulesAtPlay: structuredClone(rules) };
}

export function matchReducer(m: MatchState, a: MatchAction): MatchState {
  if (a.type === 'new') return newMatch(a.seed, a.rules);

  if (a.type === 'nextRound') {
    if (!roundDone(m) || m.round >= a.rules.game.rounds - 1) return m;
    const round = m.round + 1;
    const next = (p: PlayerId): PlayerState => ({
      ...m.players[p],
      ...dealHand(m.seed, round, p, a.rules),
      selected: [],
      played: null,
      timedOut: false,
      rulesAtPlay: null,
    });
    const players: [PlayerState, PlayerState] = [next(0), next(1)];
    return { ...m, round, players };
  }

  const pl = m.players[a.p];
  if (a.type !== 'sort' && pl.played !== null) return m; // ce joueur a déjà posé cette manche

  switch (a.type) {
    case 'toggle': {
      if (pl.selected.includes(a.id)) return setPlayer(m, a.p, { ...pl, selected: pl.selected.filter((x) => x !== a.id) });
      if (pl.selected.length >= a.max) return m;
      return setPlayer(m, a.p, { ...pl, selected: [...pl.selected, a.id] });
    }
    case 'discard': {
      const n = pl.selected.length;
      const g = a.rules.game;
      if (n === 0 || n > g.maxDiscardCards || pl.discardsUsed >= g.maxDiscards || pl.drawPile.length < n) return m;
      const kept = pl.hand.filter((c) => !pl.selected.includes(c.id));
      return setPlayer(m, a.p, {
        ...pl,
        hand: [...kept, ...pl.drawPile.slice(0, n)],
        drawPile: pl.drawPile.slice(n),
        selected: [],
        discardsUsed: pl.discardsUsed + 1,
      });
    }
    case 'play':
    case 'timeout': {
      if (a.type === 'play' && pl.selected.length === 0) return m;
      // Au chrono : on pose la sélection telle quelle (vide → manche à 0).
      const cards = pl.selected.map((id) => pl.hand.find((c) => c.id === id)!).filter(Boolean).slice(0, a.rules.game.maxPlay);
      return setPlayer(m, a.p, commit(pl, m.round, cards, a.rules, a.type === 'timeout'));
    }
    case 'sort': {
      const hand = pl.hand.slice().sort((x, y) =>
        a.by === 'rank'
          ? y.rank - x.rank || SUIT_ORDER[x.suit] - SUIT_ORDER[y.suit]
          : SUIT_ORDER[x.suit] - SUIT_ORDER[y.suit] || y.rank - x.rank,
      );
      return setPlayer(m, a.p, { ...pl, hand });
    }
  }
}
