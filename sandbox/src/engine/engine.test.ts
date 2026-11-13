import { describe, expect, it } from 'vitest';
import { cloneRules, DEFAULT_RULES } from './defaultRules';
import { createDeck, makeRng, shuffle } from './deck';
import { detectHand } from './hands';
import { crowdLevel, scoreHand } from './score';
import type { Card, Rank, SuitId } from './types';

const S: Record<string, SuitId> = { c: 'coupes', d: 'deniers', e: 'epees', b: 'batons' };
const R: Record<string, Rank> = { V: 11, D: 12, R: 13, A: 14 };
/** "Ac 10e 5b" → cartes. */
function h(s: string): Card[] {
  return s.split(' ').map((t) => {
    const suit = S[t.slice(-1)];
    const r = t.slice(0, -1);
    const rank = (R[r] ?? Number(r)) as Rank;
    return { id: `${suit}-${rank}`, suit, rank };
  });
}
const hand = (s: string) => detectHand(h(s))?.hand;

describe('detectHand', () => {
  it.each([
    ['Ac', 'high_card'],
    ['Ac 3e 7b 9d Ve', 'high_card'],
    ['Ac Ae', 'pair'],
    ['Ac Ae 7b', 'pair'],
    ['Ac Ae 7b 7d', 'two_pair'],
    ['Ac Ae Ab 2d', 'three'],
    ['2c 3e 4b 5d 6c', 'straight'],
    ['Ac 2e 3b 4d 5c', 'straight'],
    ['10c Ve Db Rd Ac', 'straight'],
    ['2c 5c 7c 9c Rc', 'flush'],
    ['Ac Ae Ab 7d 7c', 'full_house'],
    ['7c 7e 7b 7d Ac', 'four'],
    ['5e 6e 7e 8e 9e', 'straight_flush'],
    ['10c Vc Dc Rc Ac', 'straight_flush'],
  ])('%s → %s', (cards, expected) => {
    expect(hand(cards)).toBe(expected);
  });

  it('pas de suite qui boucle (R-A-2-3-4)', () => {
    expect(hand('Rc Ae 2b 3d 4c')).toBe('high_card');
  });

  it('suite et couleur exigent 5 cartes', () => {
    expect(hand('2c 3c 4c 5c')).toBe('high_card');
  });

  it('une main désactivée retombe sur la suivante', () => {
    const r = detectHand(h('2c 5c 7c 9c Rc'), (id) => id !== 'flush');
    expect(r?.hand).toBe('high_card');
    const full = detectHand(h('Ac Ae Ab 7d 7c'), (id) => id !== 'full_house');
    expect(full?.hand).toBe('three');
  });

  it('seules les cartes qui comptent sont retenues', () => {
    expect(detectHand(h('Ac Ae 7b'))!.scoring.map((c) => c.rank)).toEqual([14, 14]);
    expect(detectHand(h('3c 9e 7b'))!.scoring.map((c) => c.rank)).toEqual([9]);
  });
});

describe('scoreHand', () => {
  it('paire d’As : (10 + 11 + 11) × 2 = 64', () => {
    const r = scoreHand(h('Ac Ae 7b'), DEFAULT_RULES);
    expect(r.hand).toBe('pair');
    expect(r.chips).toBe(32);
    expect(r.mult).toBe(2);
    expect(r.score).toBe(64);
  });

  it('couleur : (35 + 2+5+7+9+10) × 4 = 272', () => {
    expect(scoreHand(h('2c 5c 7c 9c Rc'), DEFAULT_RULES).score).toBe(272);
  });

  it('les familles : +chips, +mult puis ×mult, carte par carte', () => {
    const rules = cloneRules(DEFAULT_RULES);
    rules.suits.coupes = { ...rules.suits.coupes, chips: 5, plusMult: 1, xMult: 2 };
    // paire Ac Ae : base 10×2 ; Ac → +11, +5 chips, mult (2+1)×2 = 6 ; Ae → +11
    const r = scoreHand(h('Ac Ae'), rules);
    expect(r.chips).toBe(37);
    expect(r.mult).toBe(6);
    expect(r.score).toBe(222);
    expect(r.steps.map((s) => s.kind)).toEqual(['hand', 'card', 'suit', 'card', 'total']);
  });

  it('main vide → 0', () => {
    expect(scoreHand([], DEFAULT_RULES).score).toBe(0);
  });
});

describe('deck & foule', () => {
  it('52 cartes uniques, mélange reproductible', () => {
    const deck = createDeck();
    expect(new Set(deck.map((c) => c.id)).size).toBe(52);
    expect(shuffle(deck, makeRng(42))).toEqual(shuffle(deck, makeRng(42)));
    expect(shuffle(deck, makeRng(42))).not.toEqual(shuffle(deck, makeRng(43)));
  });

  it('paliers de foule', () => {
    const t = DEFAULT_RULES.crowd;
    expect(crowdLevel(0, t)).toBe(0);
    expect(crowdLevel(64, t)).toBe(1);
    expect(crowdLevel(272, t)).toBe(2);
    expect(crowdLevel(5000, t)).toBe(4);
  });
});
