/**
 * La foule : ~500 spectateurs instanciés (corps, tête, deux bras) dans les tribunes, aux couleurs du camp
 * le plus proche. À chaque frame, ils sautent et lèvent les bras selon le niveau (CROWD).
 */
import * as THREE from 'three';
import { makeRng } from '../../engine/deck';
import { BLUE, CROWD, CROWD_SEED, RED, type CrowdParams } from './config';
import { std } from './materials';
import { createStands, placeSpectators, type Spectator } from './stands';
import type { Motion } from './state';

export interface Crowd {
  spectators: Spectator[];
  bodies: THREE.InstancedMesh;
  heads: THREE.InstancedMesh;
  /** Deux instances par spectateur : bras gauche (2i) puis bras droit (2i + 1). */
  arms: THREE.InstancedMesh;
}

const SIDES = [-1, 1] as const;

// ---------------------------------------------------------------- construction

/**
 * Construit les tribunes et la foule, et les ajoute à la scène.
 * Un seul tirage (CROWD_SEED) sert au placement puis aux couleurs, dans cet ordre.
 */
export function createCrowd(scene: THREE.Scene): Crowd {
  const rng = makeRng(CROWD_SEED);
  scene.add(createStands());
  const spectators = placeSpectators(rng);
  const crowd = { spectators, ...createCrowdMeshes(spectators.length) };
  paintCrowd(crowd, rng);
  scene.add(crowd.bodies, crowd.heads, crowd.arms);
  return crowd;
}

/** Géométries pivot aux pieds (corps, tête) et à l'épaule (bras), un matériau blanc teinté par instance. */
function createCrowdMeshes(n: number): Omit<Crowd, 'spectators'> {
  const bodyGeo = new THREE.CapsuleGeometry(0.24, 0.5, 4, 8);
  bodyGeo.translate(0, 0.5, 0);
  const headGeo = new THREE.SphereGeometry(0.19, 12, 8);
  headGeo.translate(0, 1.18, 0);
  const armGeo = new THREE.CapsuleGeometry(0.07, 0.45, 3, 6);
  armGeo.translate(0, 0.3, 0);
  const crowdMat = std(0xffffff, { emissive: 0x1a1a1a });
  const bodies = new THREE.InstancedMesh(bodyGeo, crowdMat, n);
  const heads = new THREE.InstancedMesh(headGeo, crowdMat.clone(), n);
  const arms = new THREE.InstancedMesh(armGeo, crowdMat.clone(), n * 2);
  return { bodies, heads, arms };
}

/** Corps et bras à la couleur du camp (bleu à gauche, rouge à droite), plus ou moins sombres ; têtes en tons chair. */
function paintCrowd(crowd: Crowd, rng: () => number): void {
  const c = new THREE.Color();
  crowd.spectators.forEach((s, i) => {
    const base = s.x < 0 ? BLUE : RED;
    c.setHex(base).multiplyScalar(0.55 + rng() * 0.45);
    crowd.bodies.setColorAt(i, c);
    crowd.arms.setColorAt(i * 2, c);
    crowd.arms.setColorAt(i * 2 + 1, c);
    c.setHSL(0.07, 0.35, 0.45 + rng() * 0.3);
    crowd.heads.setColorAt(i, c);
  });
}

// ---------------------------------------------------------------- animation

// Objets de travail réutilisés à chaque frame (pas d'allocation dans la boucle).
const m4 = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const v = new THREE.Vector3();
const ONE = new THREE.Vector3(1, 1, 1);
const ZERO = new THREE.Vector3(0, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** Paramètres de la foule pour un niveau lissé (0..4), interpolés entre deux niveaux entiers. */
export function crowdParams(level: number): CrowdParams {
  const i = Math.min(3, Math.floor(level));
  const f = level - i;
  const a = CROWD[i];
  const b = CROWD[i + 1];
  return { amp: a.amp + (b.amp - a.amp) * f, speed: a.speed + (b.speed - a.speed) * f, raised: a.raised + (b.raised - a.raised) * f };
}

/** Met à jour les matrices de toutes les instances pour l'instant `t` (s) et le niveau lissé. */
export function updateCrowd(crowd: Crowd, t: number, level: number, motion: Motion): void {
  const p = crowdParams(level);
  crowd.spectators.forEach((s, i) => {
    const hop = Math.abs(Math.sin(t * p.speed * s.speed + s.phase)) * p.amp * motion.scale;
    poseSpectator(crowd, s, i, t, hop);
    const up = s.hype < p.raised;
    for (const side of SIDES) {
      if (up) raisedArmMatrix(s, side, t, p.speed, hop);
      else hiddenArmMatrix(s);
      crowd.arms.setMatrixAt(i * 2 + (side < 0 ? 0 : 1), m4);
    }
  });
  crowd.bodies.instanceMatrix.needsUpdate = true;
  crowd.heads.instanceMatrix.needsUpdate = true;
  crowd.arms.instanceMatrix.needsUpdate = true;
}

/** Corps et tête : tournés vers le ring, soulevés de `hop`, avec un léger balancement. */
function poseSpectator(crowd: Crowd, s: Spectator, i: number, t: number, hop: number): void {
  const sway = Math.sin(t * 1.3 + s.phase) * 0.05;
  e.set(0, s.rot + Math.PI, sway);
  q.setFromEuler(e);
  v.set(s.x, s.y + hop, s.z);
  m4.compose(v, q, ONE);
  crowd.bodies.setMatrixAt(i, m4);
  crowd.heads.setMatrixAt(i, m4);
}

/** Bras levé (`side` = -1 gauche, 1 droit) qui s'agite, accroché à l'épaule : écrit dans `m4`. */
function raisedArmMatrix(s: Spectator, side: -1 | 1, t: number, speed: number, hop: number): void {
  const wave = Math.sin(t * speed + s.phase + side) * 0.25;
  e.set(0, s.rot + Math.PI, side * (0.35 + wave));
  q.setFromEuler(e);
  // épaule, dans le repère du spectateur
  v.set(side * 0.28, 0.82, 0).applyAxisAngle(Y_AXIS, s.rot + Math.PI);
  v.x += s.x; v.y += s.y + hop; v.z += s.z;
  m4.compose(v, q, ONE);
}

/** Bras baissé : instance réduite à rien (échelle nulle) : écrit dans `m4`. */
function hiddenArmMatrix(s: Spectator): void {
  m4.compose(v.set(s.x, s.y, s.z), q, ZERO);
}
