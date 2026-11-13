import type { Rules } from './types';

/**
 * Règles de départ : table chips × mult classique des mains de poker.
 * Les familles sont neutres (0 / +0 / ×1) — à toi de jouer avec dans le bac à sable.
 */
export const DEFAULT_RULES: Rules = {
  hands: {
    high_card: { label: 'Carte haute', chips: 5, mult: 1, enabled: true },
    pair: { label: 'Paire', chips: 10, mult: 2, enabled: true },
    two_pair: { label: 'Double paire', chips: 20, mult: 2, enabled: true },
    three: { label: 'Brelan', chips: 30, mult: 3, enabled: true },
    straight: { label: 'Suite', chips: 30, mult: 4, enabled: true },
    flush: { label: 'Couleur', chips: 35, mult: 4, enabled: true },
    full_house: { label: 'Full', chips: 40, mult: 4, enabled: true },
    four: { label: 'Carré', chips: 60, mult: 7, enabled: true },
    straight_flush: { label: 'Quinte flush', chips: 100, mult: 8, enabled: true },
  },
  rankChips: {
    2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10,
    11: 10, 12: 10, 13: 10, 14: 11,
  },
  suits: {
    coupes: { name: 'Coupes', symbol: '♥', color: '#E2264D', chips: 0, plusMult: 0, xMult: 1 },
    deniers: { name: 'Deniers', symbol: '◆', color: '#FFD23F', chips: 0, plusMult: 0, xMult: 1 },
    epees: { name: 'Épées', symbol: '♠', color: '#1B8FD6', chips: 0, plusMult: 0, xMult: 1 },
    batons: { name: 'Bâtons', symbol: '♣', color: '#FFFFFF', chips: 0, plusMult: 0, xMult: 1 },
  },
  game: { rounds: 5, turnSeconds: 45, handSize: 8, maxPlay: 5, maxDiscards: 10, maxDiscardCards: 5 },
  crowd: [40, 150, 400, 900],
};

export function cloneRules(r: Rules): Rules {
  return structuredClone(r);
}
