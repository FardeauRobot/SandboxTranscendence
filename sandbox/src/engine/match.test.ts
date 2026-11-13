import { describe, expect, it } from 'vitest';
import { cloneRules, DEFAULT_RULES } from './defaultRules';
import { matchOver, matchReducer, newMatch, roundDone, total, winner, type MatchState, type PlayerId } from './match';
import { scoreHand } from './score';

const rules = cloneRules(DEFAULT_RULES);

const select = (m: MatchState, p: PlayerId, n: number) =>
  m.players[p].hand.slice(0, n).reduce((s, c) => matchReducer(s, { type: 'toggle', p, id: c.id, max: 8 }), m);

const discardOnce = (m: MatchState, p: PlayerId) => matchReducer(select(m, p, 1), { type: 'discard', p, rules });

const playBoth = (m: MatchState) => {
  for (const p of [0, 1] as const) m = matchReducer(select(m, p, 1), { type: 'play', p, rules });
  return m;
};

describe('match', () => {
  it('valeurs par défaut : 5 manches, 45 s, 10 défausses par match', () => {
    expect(rules.game).toMatchObject({ rounds: 5, turnSeconds: 45, maxDiscards: 10 });
  });

  it('même seed → mêmes mains ; les deux joueurs ont des mains différentes', () => {
    const a = newMatch(42, rules);
    const b = newMatch(42, rules);
    expect(a.players[0].hand).toEqual(b.players[0].hand);
    expect(a.players[0].hand).not.toEqual(a.players[1].hand);
  });

  it('les défausses sont un budget pour tout le match, pas par manche', () => {
    let m = newMatch(1, rules);
    for (let i = 0; i < 6; i++) m = discardOnce(m, 0);
    m = playBoth(m);
    m = matchReducer(m, { type: 'nextRound', rules });
    expect(m.players[0].discardsUsed).toBe(6);
    for (let i = 0; i < 6; i++) m = discardOnce(m, 0);
    expect(m.players[0].discardsUsed).toBe(10);
    expect(m.players[1].discardsUsed).toBe(0);
  });

  it('chrono écoulé : la sélection est posée et comptée', () => {
    let m = select(newMatch(3, rules), 0, 2);
    const cards = m.players[0].hand.slice(0, 2);
    m = matchReducer(m, { type: 'timeout', p: 0, rules });
    expect(m.players[0].played).toEqual(cards);
    expect(m.players[0].timedOut).toBe(true);
    expect(m.players[0].scores[0]).toBe(scoreHand(cards, rules).score);
  });

  it('chrono écoulé sans sélection : la manche vaut 0', () => {
    const m = matchReducer(newMatch(3, rules), { type: 'timeout', p: 1, rules });
    expect(m.players[1].played).toEqual([]);
    expect(m.players[1].scores[0]).toBe(0);
  });

  it('un joueur qui a posé ne peut plus agir dans la manche', () => {
    let m = matchReducer(select(newMatch(5, rules), 0, 1), { type: 'play', p: 0, rules });
    const after = discardOnce(m, 0);
    expect(after).toBe(m);
    m = matchReducer(m, { type: 'nextRound', rules });
    expect(m.round).toBe(0); // l'autre n'a pas encore posé
  });

  it('5 manches, puis le score cumulé désigne le vainqueur', () => {
    let m = newMatch(9, rules);
    for (let r = 0; r < 5; r++) {
      expect(roundDone(m)).toBe(false);
      m = playBoth(m);
      expect(roundDone(m)).toBe(true);
      if (r < 4) m = matchReducer(m, { type: 'nextRound', rules });
    }
    expect(m.round).toBe(4);
    expect(matchOver(m, rules)).toBe(true);
    expect(matchReducer(m, { type: 'nextRound', rules })).toBe(m);
    const [a, b] = m.players.map(total);
    expect(m.players[0].scores).toHaveLength(5);
    expect(winner(m, rules)).toBe(a === b ? null : a > b ? 0 : 1);
  });
});
