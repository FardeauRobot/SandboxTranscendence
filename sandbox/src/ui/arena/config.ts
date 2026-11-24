/**
 * Réglages de l'arène : couleurs, danse du Y Bot, combattants, foule et tribunes.
 * Tous les nombres « de réglage » sont ici ; les modules de construction ne gardent que la géométrie fine.
 * Les positions (combattants, lumières, caméra) sont à part, dans `layout.ts`, modifiables à la souris.
 */

// ---- Couleurs (DA)
export const BLUE = 0x1b8fd6;
export const RED = 0xe2264d;
export const YELLOW = 0xffd23f;
export const INK = 0x111111;

// ---- Le Y Bot (public/models/all_dances.glb, généré par Labo/Animations : `idle` + une danse par main)
export const MODEL_URL = `${import.meta.env.BASE_URL}models/all_dances.glb`;
// Quelle danse pour quelle main : `dances.ts`.
/** Clip de repos, joué en boucle entre deux danses. */
export const IDLE_CLIP = 'idle';
/** Nombre de fois que la danse est jouée à chaque main posée. */
export const DANCE_REPEAT = 2;
/** Le Y Bot mesure 1,80 m ; les silhouettes font ~2,4 unités. */
export const MODEL_SCALE = 1.3;
/** Durée des fondus entre repos et danse (s). Le retour au repos fond sur 2 × FADE. */
export const FADE = 0.25;

// ---- Apparences (skins)
// Un GLB par personnage, riggé sur le squelette de MODEL_URL (mêmes noms d'os), sans clips : les danses
// viennent toujours de MODEL_URL et s'appliquent à n'importe quelle apparence. null = le Y Bot de MODEL_URL,
// teinté à la couleur du joueur. Fabrication : `animation-test/volt/` à la racine du labo (script Blender).
export const SKINS = {
  ybot: null,
  /** Volt, le robot danseur du casting (concept n° 1) : garde ses propres couleurs. */
  volt: `${import.meta.env.BASE_URL}models/skins/volt.glb`,
} as const satisfies Record<string, string | null>;
export type SkinId = keyof typeof SKINS;

// ---- Combattants
export interface FighterSpec {
  /** Couleur du corps (silhouette ou Y Bot teinté). */
  color: number;
  /** Apparence une fois chargée (SKINS). Si son GLB ne charge pas, on retombe sur le Y Bot teinté. */
  skin: SkinId;
  /** Couleur de l'aura (coques, particules, lumière). */
  auraColor: number;
  /** Décalage (s) de l'animation procédurale, pour que les deux ne bougent pas en miroir. */
  timeOffset: number;
  /** Avance (s) donnée au repos du Y Bot à son chargement, pour la même raison. */
  idleOffset?: number;
}

/** J1 bleu (Volt, aura jaune), J2 rouge (Y Bot). Leur place sur le ring est dans `layout.ts`. */
export const FIGHTERS: readonly [FighterSpec, FighterSpec] = [
  { color: BLUE, skin: 'volt', auraColor: YELLOW, timeOffset: 0 },
  { color: RED, skin: 'ybot', auraColor: RED, timeOffset: 1.3, idleOffset: 0.9 },
];

/** Aura minimale affichée au repos (une petite aura de veille). */
export const AURA_IDLE = 0.1;

// ---- Mouvement réduit (prefers-reduced-motion) : facteur appliqué aux amplitudes et vitesses
export const REDUCED_MOTION_SCALE = 0.25;

// ---- Foule
export interface CrowdParams {
  /** Amplitude du saut. */
  amp: number;
  /** Vitesse du saut. */
  speed: number;
  /** Part des spectateurs qui lèvent les bras (0..1). */
  raised: number;
}

/** Paramètres de la foule par niveau (0..4) : amplitude du saut, vitesse, part de bras levés. */
export const CROWD: readonly CrowdParams[] = [
  { amp: 0.03, speed: 1.2, raised: 0 },
  { amp: 0.08, speed: 2.2, raised: 0.1 },
  { amp: 0.18, speed: 3.2, raised: 0.35 },
  { amp: 0.32, speed: 4.4, raised: 0.7 },
  { amp: 0.5, speed: 5.6, raised: 1 },
];

/** Graine du tirage de la foule (placement puis couleurs) : la même foule à chaque partie. */
export const CROWD_SEED = 7;

// ---- Tribunes
/** Vide dans les tribunes, face à la caméra, pour voir les combattants (rad, de chaque côté de l'axe). */
export const GAP = 1.05;
/** Gradins : nombre de rangs, rayon du premier rang, profondeur et hauteur d'une marche. */
export const STANDS = { tiers: 6, r0: 8, depth: 1.5, rise: 0.65 } as const;
/** Largeur d'une place sur un rang : fixe le nombre de spectateurs par rang. */
export const SEAT_WIDTH = 0.78;
