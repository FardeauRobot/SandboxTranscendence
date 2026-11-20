import { describe, expect, it } from 'vitest';
import { scoreHand } from '../../engine/score';
import { DEFAULT_RULES as defaultRules } from '../../engine/defaultRules';
import type { Card, Rank, SuitId } from '../../engine/types';
import { DANCE_IDS, danceFor } from './dances';

const card = (rank: Rank, suit: SuitId = 'coupes', i = 0): Card => ({ id: `${rank}${suit}${i}`, suit, rank });
const mixed = (ranks: Rank[]) => ranks.map((r, i) => card(r, (['coupes', 'deniers', 'epees', 'batons'] as const)[i % 4], i));
const dance = (cards: Card[]) => danceFor(scoreHand(cards, defaultRules).hand, cards);

describe('danceFor', () => {
  it('donne une danse à chaque main, de la royale à la carte haute', () => {
    expect(dance([10, 11, 12, 13, 14].map((r) => card(r as Rank)))).toBe('quinte_flush_royale');
    expect(dance([9, 10, 11, 12, 13].map((r) => card(r as Rank)))).toBe('quinte_flush');
    expect(dance(mixed([7, 7, 7, 7, 2]))).toBe('carre');
    expect(dance(mixed([7, 7, 7, 2, 2]))).toBe('full');
    expect(dance([2, 5, 8, 11, 13].map((r) => card(r as Rank)))).toBe('flush');
    expect(dance(mixed([10, 11, 12, 13, 14]))).toBe('quinte');
    expect(dance(mixed([7, 7, 7]))).toBe('brelan');
    expect(dance(mixed([7, 7, 2, 2]))).toBe('deux_paires');
    expect(dance(mixed([7, 7]))).toBe('paire');
    expect(dance(mixed([7]))).toBe('carte_haute');
  });

  it("la quinte flush à l'As bas n'est pas royale", () => {
    expect(dance([14, 2, 3, 4, 5].map((r) => card(r as Rank)))).toBe('quinte_flush');
  });

  it('pas de main, pas de danse', () => {
    expect(danceFor(null, [])).toBeNull();
  });

  it('dix danses distinctes', () => {
    expect(new Set(DANCE_IDS).size).toBe(10);
  });
});
