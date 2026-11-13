import { HAND_IDS, type Card, type HandId } from './types';

/** Un détecteur renvoie les cartes qui « comptent » pour la main, ou null si la main n'est pas là. */
type Matcher = (cards: Card[]) => Card[] | null;

function byRank(cards: Card[]): Map<number, Card[]> {
  const m = new Map<number, Card[]>();
  for (const c of cards) m.set(c.rank, [...(m.get(c.rank) ?? []), c]);
  return m;
}

/** Groupes de même rang, les plus gros puis les plus hauts d'abord. */
function groups(cards: Card[]): Card[][] {
  return [...byRank(cards).values()].sort((a, b) => b.length - a.length || b[0].rank - a[0].rank);
}

function isFlush(cards: Card[]): boolean {
  return cards.length === 5 && cards.every((c) => c.suit === cards[0].suit);
}

function isStraight(cards: Card[]): boolean {
  if (cards.length !== 5) return false;
  const ranks = [...new Set(cards.map((c) => c.rank))].sort((a, b) => a - b);
  if (ranks.length !== 5) return false;
  if (ranks[4] - ranks[0] === 4) return true;
  // As bas : A-2-3-4-5
  return ranks.join(',') === '2,3,4,5,14';
}

const MATCHERS: Record<HandId, Matcher> = {
  straight_flush: (c) => (isFlush(c) && isStraight(c) ? c : null),
  four: (c) => {
    const g = groups(c)[0];
    return g && g.length >= 4 ? g.slice(0, 4) : null;
  },
  full_house: (c) => {
    const [a, b] = groups(c);
    return a && b && a.length === 3 && b.length >= 2 ? [...a, ...b] : null;
  },
  flush: (c) => (isFlush(c) ? c : null),
  straight: (c) => (isStraight(c) ? c : null),
  three: (c) => {
    const g = groups(c)[0];
    return g && g.length >= 3 ? g.slice(0, 3) : null;
  },
  two_pair: (c) => {
    const [a, b] = groups(c);
    return a && b && a.length >= 2 && b.length >= 2 ? [...a.slice(0, 2), ...b.slice(0, 2)] : null;
  },
  pair: (c) => {
    const g = groups(c)[0];
    return g && g.length >= 2 ? g.slice(0, 2) : null;
  },
  high_card: (c) => {
    if (c.length === 0) return null;
    const top = c.reduce((best, x) => (x.rank > best.rank ? x : best));
    return [top];
  },
};

/**
 * Meilleure main reconnue parmi les mains activées.
 * Une main désactivée est simplement sautée : une couleur sans « Couleur » retombe sur la suivante.
 */
export function detectHand(
  cards: Card[],
  enabled: (id: HandId) => boolean = () => true,
): { hand: HandId; scoring: Card[] } | null {
  for (let i = HAND_IDS.length - 1; i >= 0; i--) {
    const id = HAND_IDS[i];
    if (!enabled(id)) continue;
    const scoring = MATCHERS[id](cards);
    if (scoring) return { hand: id, scoring };
  }
  return null;
}
