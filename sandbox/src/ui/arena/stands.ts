/**
 * Tribunes en gradins autour du ring, ouvertes face à la caméra (GAP), et placement des spectateurs.
 * Chaque rang est une marche (anneau), pas un disque plein qui enterrerait les rangs intérieurs.
 */
import * as THREE from 'three';
import { GAP, SEAT_WIDTH, STANDS } from './config';
import { std } from './materials';

/** Un spectateur : sa place dans les gradins et son caractère (rythme, envie de lever les bras). */
export interface Spectator {
  x: number;
  z: number;
  /** Hauteur de sa marche. */
  y: number;
  /** Angle autour du ring (le spectateur regarde le centre). */
  rot: number;
  /** Déphasage de son saut et de son balancement. */
  phase: number;
  /** Facteur de vitesse propre (0,8..1,3). */
  speed: number;
  /** Lève les bras dès que la part de bras levés du niveau dépasse cette valeur (0..1). */
  hype: number;
}

/** Ouverture des tribunes : tout le tour sauf le vide face à la caméra (rad). */
const ARC = Math.PI * 2 - GAP * 2;

/** Gradins : profil en escalier tourné autour de l'axe vertical, sur ARC. */
export function createStands(): THREE.Mesh {
  const stands = new THREE.Mesh(
    new THREE.LatheGeometry(standsProfile(), 96, GAP, ARC),
    std(0x121212, { roughness: 1, side: THREE.DoubleSide }),
  );
  stands.position.y = 0.002;
  stands.receiveShadow = true;
  return stands;
}

/** Profil (rayon, hauteur) d'une coupe des gradins, de l'intérieur vers le mur arrière. */
function standsProfile(): THREE.Vector2[] {
  const { tiers, r0, depth, rise } = STANDS;
  const profile: THREE.Vector2[] = [new THREE.Vector2(r0 - depth / 2, 0)];
  for (let k = 0; k < tiers; k++) {
    const inner = r0 + k * depth - depth / 2;
    if (k > 0) profile.push(new THREE.Vector2(inner, (k - 1) * rise), new THREE.Vector2(inner, k * rise));
    profile.push(new THREE.Vector2(inner + depth, k * rise));
  }
  const last = profile[profile.length - 1];
  profile.push(new THREE.Vector2(last.x, 0)); // mur arrière
  return profile;
}

/** Place les spectateurs rang par rang. L'ordre des tirages de `rng` fixe la foule : ne pas le changer. */
export function placeSpectators(rng: () => number): Spectator[] {
  const spectators: Spectator[] = [];
  for (let k = 0; k < STANDS.tiers; k++) {
    const R = STANDS.r0 + k * STANDS.depth;
    const y = k * STANDS.rise;
    const count = Math.floor((ARC * R) / SEAT_WIDTH);
    for (let i = 0; i < count; i++) spectators.push(placeSpectator(rng, R, y, i, count));
  }
  return spectators;
}

/** Spectateur n° `i` sur `count` d'un rang de rayon `R` : réparti régulièrement, avec un peu de jeu. */
function placeSpectator(rng: () => number, R: number, y: number, i: number, count: number): Spectator {
  const th = GAP + ((i + 0.5) / count) * ARC + (rng() - 0.5) * 0.02;
  const r = R + (rng() - 0.5) * 0.3;
  return {
    x: Math.sin(th) * r, z: Math.cos(th) * r, y, rot: th,
    phase: rng() * Math.PI * 2, speed: 0.8 + rng() * 0.5, hype: rng(),
  };
}
