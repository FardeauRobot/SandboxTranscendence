/**
 * Quelle danse pour quelle main posée. Les clips sont ceux de `public/models/all_dances.glb`
 * (généré par Labo/Animations, un clip par main). Le moteur ne connaît pas la quinte flush royale :
 * c'est une quinte flush à l'As, reconnue ici à partir des cartes.
 */
import type { Card, HandId } from '../../engine/types';

export const DANCE_IDS = [
  'quinte_flush_royale', // 6 7
  'quinte_flush', //        Reverse 6 7
  'carre', //               Aura Farming boat
  'full', //                Scuba dab
  'flush', //               CHTTTTT !
  'quinte', //              Rasputin
  'brelan', //              Gangnam Style
  'deux_paires', //         Danse des canards
  'paire', //               Siuuu
  'carte_haute', //         Hip Hop
] as const;
export type DanceId = (typeof DANCE_IDS)[number];

/** Nom de la danse, pour l'éditeur de scène. */
export const DANCE_LABEL: Record<DanceId, string> = {
  quinte_flush_royale: '6 7',
  quinte_flush: 'Reverse 6 7',
  carre: 'Aura Farming boat',
  full: 'Scuba dab',
  flush: 'CHTTTTT !',
  quinte: 'Rasputin',
  brelan: 'Gangnam Style',
  deux_paires: 'Danse des canards',
  paire: 'Siuuu',
  carte_haute: 'Hip Hop',
};

const HAND_DANCE: Record<HandId, DanceId> = {
  straight_flush: 'quinte_flush',
  four: 'carre',
  full_house: 'full',
  flush: 'flush',
  straight: 'quinte',
  three: 'brelan',
  two_pair: 'deux_paires',
  pair: 'paire',
  high_card: 'carte_haute',
};

/** 10-V-D-R-As. */
function isRoyal(cards: Card[]): boolean {
  return [...cards.map((c) => c.rank)].sort((a, b) => a - b).join(',') === '10,11,12,13,14';
}

/** La danse de la main reconnue `hand` (posée avec `cards`), ou null si aucune main. */
export function danceFor(hand: HandId | null, cards: Card[]): DanceId | null {
  if (!hand) return null;
  if (hand === 'straight_flush' && isRoyal(cards)) return 'quinte_flush_royale';
  return HAND_DANCE[hand];
}
