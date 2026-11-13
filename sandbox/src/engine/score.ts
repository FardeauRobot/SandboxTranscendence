import { RANK_LABEL } from './deck';
import { detectHand } from './hands';
import type { Card, Rules, ScoreResult, ScoreStep } from './types';

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''));

/**
 * Pipeline de score. Chaque étape est enregistrée, pour que le panneau puisse montrer le calcul.
 * Un futur modificateur = une étape de plus, insérée ici.
 *
 *   1. main reconnue      → chips = base, mult = base
 *   2. chaque carte qui compte, de gauche à droite :
 *        + chips du rang
 *        + chips famille, + mult famille, puis × mult famille
 *   3. score = floor(chips × mult)
 */
export function scoreHand(cards: Card[], rules: Rules): ScoreResult {
  const detected = detectHand(cards, (id) => rules.hands[id].enabled);
  if (!detected) return { hand: null, scoringIds: [], steps: [], chips: 0, mult: 0, score: 0 };

  const { hand, scoring } = detected;
  const base = rules.hands[hand];
  let chips = base.chips;
  let mult = base.mult;
  const steps: ScoreStep[] = [
    { kind: 'hand', label: base.label, effect: `${base.chips} chips × ${base.mult} mult`, chips, mult },
  ];

  // On garde l'ordre de la main posée, pas l'ordre du détecteur.
  const scoringIds = new Set(scoring.map((c) => c.id));
  for (const card of cards.filter((c) => scoringIds.has(c.id))) {
    const suit = rules.suits[card.suit];
    const name = `${RANK_LABEL[card.rank]}${suit.symbol}`;

    const rc = rules.rankChips[card.rank];
    chips += rc;
    steps.push({ kind: 'card', label: name, effect: `+${fmt(rc)} chips`, chips, mult, cardId: card.id });

    const parts: string[] = [];
    if (suit.chips) { chips += suit.chips; parts.push(`${suit.chips > 0 ? '+' : ''}${fmt(suit.chips)} chips`); }
    if (suit.plusMult) { mult += suit.plusMult; parts.push(`${suit.plusMult > 0 ? '+' : ''}${fmt(suit.plusMult)} mult`); }
    if (suit.xMult !== 1) { mult *= suit.xMult; parts.push(`×${fmt(suit.xMult)} mult`); }
    if (parts.length) {
      steps.push({ kind: 'suit', label: `${name} · ${suit.name}`, effect: parts.join(', '), chips, mult, cardId: card.id });
    }
  }

  const score = Math.floor(chips * mult);
  steps.push({ kind: 'total', label: 'Total', effect: `${fmt(chips)} × ${fmt(mult)}`, chips, mult });
  return { hand, scoringIds: [...scoringIds], steps, chips, mult, score };
}

/** Niveau de réaction de la foule, 0 (silence) à 4 (délire). */
export function crowdLevel(score: number, thresholds: readonly number[]): number {
  let level = 0;
  thresholds.forEach((t, i) => { if (score >= t) level = i + 1; });
  return level;
}
