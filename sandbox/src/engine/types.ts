// Types du moteur. Aucun import React ici : ce dossier doit pouvoir partir tel quel côté serveur.

export type SuitId = 'coupes' | 'deniers' | 'epees' | 'batons';
export const SUIT_IDS: readonly SuitId[] = ['coupes', 'deniers', 'epees', 'batons'];

/** 2..10, 11 = Valet, 12 = Dame, 13 = Roi, 14 = As */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export const RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export interface Card {
  id: string;
  suit: SuitId;
  rank: Rank;
}

/** Du plus faible au plus fort : l'ordre sert à choisir la meilleure main reconnue. */
export const HAND_IDS = [
  'high_card',
  'pair',
  'two_pair',
  'three',
  'straight',
  'flush',
  'full_house',
  'four',
  'straight_flush',
] as const;
export type HandId = (typeof HAND_IDS)[number];

export interface HandRule {
  label: string;
  points: number;
  mult: number;
  enabled: boolean;
}

export interface SuitRule {
  name: string;
  symbol: string;
  color: string;
  /** Ajouté aux points pour chaque carte de cette famille qui compte. */
  points: number;
  /** Ajouté au mult pour chaque carte de cette famille qui compte. */
  plusMult: number;
  /** Multiplie le mult pour chaque carte de cette famille qui compte (1 = neutre). */
  xMult: number;
}

export interface GameRule {
  /** Nombre de manches du match. */
  rounds: number;
  /** Chrono de chaque joueur, par manche, en secondes. */
  turnSeconds: number;
  handSize: number;
  maxPlay: number;
  /** Budget de défausses de chaque joueur pour tout le match. */
  maxDiscards: number;
  maxDiscardCards: number;
}

export interface Rules {
  hands: Record<HandId, HandRule>;
  rankPoints: Record<Rank, number>;
  suits: Record<SuitId, SuitRule>;
  game: GameRule;
  /** 4 seuils croissants : score >= seuil[i] → niveau de foule i+1. */
  crowd: [number, number, number, number];
}

export type StepKind = 'hand' | 'card' | 'suit' | 'total';

export interface ScoreStep {
  kind: StepKind;
  label: string;
  /** Ce que l'étape ajoute, en texte (« +11 points », « ×1.5 mult »). */
  effect: string;
  /** Valeurs courantes après l'étape. */
  points: number;
  mult: number;
  cardId?: string;
}

export interface ScoreResult {
  hand: HandId | null;
  scoringIds: string[];
  steps: ScoreStep[];
  points: number;
  mult: number;
  score: number;
}
