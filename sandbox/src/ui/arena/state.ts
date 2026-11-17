/**
 * État partagé de l'arène : ce que l'extérieur pilote (niveau, auras, dernière main posée)
 * et sa version lissée, lue par tous les modules à chaque frame.
 */
import { REDUCED_MOTION_SCALE } from './config';

/** 0 = J1 (bleu, à gauche), 1 = J2 (rouge, à droite). */
export type Player = 0 | 1;

export interface ArenaState {
  /** Niveau demandé par `setLevel` (0..4). */
  targetLevel: number;
  /** Niveau affiché, qui rejoint `targetLevel` en douceur. */
  level: number;
  /** Auras demandées par `setAura` (0..1), par joueur. */
  auraTarget: [number, number];
  /** Auras affichées, lissées, par joueur. */
  auraNow: [number, number];
  /** Instant (s, horloge de l'arène) de la dernière main posée ; -10 = jamais. */
  burstT: number;
  /** Joueur qui a posé en dernier. */
  burstP: Player;
}

/** Préférence de mouvement réduit, et le facteur qu'elle applique aux amplitudes. */
export interface Motion {
  reduced: boolean;
  /** 1 normalement, REDUCED_MOTION_SCALE si l'utilisateur préfère moins d'animation. */
  scale: number;
}

export function createArenaState(): ArenaState {
  return { targetLevel: 0, level: 0, auraTarget: [0, 0], auraNow: [0, 0], burstT: -10, burstP: 0 };
}

export function createMotion(reduced: boolean): Motion {
  return { reduced, scale: reduced ? REDUCED_MOTION_SCALE : 1 };
}

/** Niveau de la foule demandé, borné à 0..4. */
export function setTargetLevel(state: ArenaState, level: number): void {
  state.targetLevel = Math.max(0, Math.min(4, level));
}

/** Aura demandée pour un joueur, bornée à 0..1. */
export function setAuraTarget(state: ArenaState, player: Player, aura: number): void {
  state.auraTarget[player] = Math.max(0, Math.min(1, aura));
}

/** Retient qui vient de poser et quand (`t` : horloge de l'arène, en s). */
export function recordBurst(state: ArenaState, player: Player, t: number): void {
  state.burstP = player;
  state.burstT = t;
}

/** Rapproche le niveau et les auras affichés de leurs cibles (`dt` en s). */
export function smoothState(state: ArenaState, dt: number): void {
  state.level += (state.targetLevel - state.level) * Math.min(1, dt * 3);
  for (const i of [0, 1] as const) {
    state.auraNow[i] += (state.auraTarget[i] - state.auraNow[i]) * Math.min(1, dt * 2.5);
  }
}

/** Temps écoulé (s) depuis la dernière main posée. */
export function sinceBurst(state: ArenaState, t: number): number {
  return t - state.burstT;
}
