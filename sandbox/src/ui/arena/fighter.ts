/**
 * Les combattants : une silhouette low-poly (capsule + sphère), son aura (coques + particules + lumière)
 * et, une fois chargé, le Y Bot dansant qui remplace la silhouette.
 *
 * Tant que le Y Bot n'est pas là (ou si son chargement échoue), la silhouette respire, saute à la pose
 * et lève les bras avec l'aura. Une fois le Y Bot là, il a son propre repos et sa danse : pas de saut
 * ni de bras procéduraux. L'aura, elle, est toujours animée.
 */
import * as THREE from 'three';
import { makeRng } from '../../engine/deck';
import { AURA_IDLE, FIGHTERS, INK, type FighterSpec } from './config';
import { attachDancer, loadDancerModel, updateDancer, type Dancer } from './dancer';
import { AURA_FADE, std } from './materials';
import type { ArenaState, Motion, Player } from './state';

export interface Fighter {
  spec: FighterSpec;
  root: THREE.Group;
  /** Contient la silhouette, puis le Y Bot une fois chargé. */
  body: THREE.Group;
  armL: THREE.Mesh;
  armR: THREE.Mesh;
  aura: THREE.Group;
  shells: THREE.Mesh[];
  particles: THREE.Points;
  light: THREE.PointLight;
  /** Présent une fois le Y Bot chargé ; les silhouettes sont alors cachées. */
  dancer?: Dancer;
}

/** Les deux combattants, indexés par joueur. */
export type Fighters = readonly [Fighter, Fighter];

/** Nombre de particules de l'aura. */
const PARTICLES = 160;
/** Hauteur au-dessus de laquelle une particule repart du sol. */
const PARTICLE_TOP = 3.6;
/** Durée du saut de la silhouette à la pose (s). */
const JUMP_TIME = 0.6;

// ---------------------------------------------------------------- construction

/** Crée les deux combattants (J1 puis J2) et les ajoute à la scène, à l'origine. */
export function createFighters(scene: THREE.Scene): Fighters {
  const fighters = [createFighter(FIGHTERS[0], 0), createFighter(FIGHTERS[1], 1)] as const;
  scene.add(fighters[0].root, fighters[1].root);
  return fighters;
}

/** Combattant n° `index` ; sa place et son orientation viennent ensuite de `applyLayout`. */
function createFighter(spec: FighterSpec, index: number): Fighter {
  const root = new THREE.Group();

  const { body, armL, armR } = createSilhouette(spec.color);
  root.add(body);
  const { aura, shells, particles } = createAura(spec.auraColor, 11 + index);
  root.add(aura);
  const light = new THREE.PointLight(spec.auraColor, 0, 8, 1.5);
  light.position.y = 1.6;
  root.add(light);

  return { spec, root, body, armL, armR, aura, shells, particles, light };
}

/** Silhouette low-poly : torse, tête, jambes, et bras dont le pivot est à l'épaule. */
function createSilhouette(color: number): { body: THREE.Group; armL: THREE.Mesh; armR: THREE.Mesh } {
  const body = new THREE.Group();
  const mat = std(color);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 6, 16), mat);
  torso.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 16), std(0xf2d0b5));
  head.position.y = 2.1;
  const legGeo = new THREE.CapsuleGeometry(0.16, 0.6, 4, 10);
  const legL = new THREE.Mesh(legGeo, std(INK));
  const legR = legL.clone();
  legL.position.set(-0.18, 0.35, 0);
  legR.position.set(0.18, 0.35, 0);
  const armGeo = new THREE.CapsuleGeometry(0.12, 0.65, 4, 10);
  armGeo.translate(0, -0.4, 0); // pivot à l'épaule
  const armL = new THREE.Mesh(armGeo, mat);
  const armR = new THREE.Mesh(armGeo, mat);
  armL.position.set(-0.55, 1.55, 0);
  armR.position.set(0.55, 1.55, 0);
  body.add(torso, head, legL, legR, armL, armR);
  body.traverse((o) => { o.castShadow = true; });
  return { body, armL, armR };
}

/** Aura : trois coques additives qui tournent + particules qui montent (tirage fixé par `seed`). */
function createAura(color: number, seed: number): { aura: THREE.Group; shells: THREE.Mesh[]; particles: THREE.Points } {
  const aura = new THREE.Group();
  const shells: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const shell = createShell(color, i);
    shells.push(shell);
    aura.add(shell);
  }
  const particles = createParticles(color, seed);
  aura.add(particles);
  return { aura, shells, particles };
}

/** Coque n° `i` : cylindre ouvert, plus large et plus haut à chaque rang, fondu en haut et en bas. */
function createShell(color: number, i: number): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0.95 + i * 0.25, 0.55 + i * 0.15, 2.8 + i * 0.4, 28, 1, true);
  geo.translate(0, 1.4 + i * 0.2, 0);
  return new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, depthWrite: false, alphaMap: AURA_FADE,
    }),
  );
}

/** Particules réparties dans un anneau autour du combattant, à des hauteurs aléatoires. */
function createParticles(color: number, seed: number): THREE.Points {
  const pos = new Float32Array(PARTICLES * 3);
  const rng = makeRng(seed);
  for (let i = 0; i < PARTICLES; i++) {
    const a = rng() * Math.PI * 2;
    const r = 0.5 + rng() * 0.8;
    pos.set([Math.cos(a) * r, rng() * 3.5, Math.sin(a) * r], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color, size: 0.09, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
}

// ---------------------------------------------------------------- Y Bot

/**
 * Charge le Y Bot et l'installe sur les deux combattants, à leur couleur.
 * `isDisposed` protège le chargement asynchrone : si l'arène a été libérée entre-temps, on ne touche à rien.
 */
export function equipDancers(fighters: Fighters, isDisposed: () => boolean): void {
  loadDancerModel((gltf) => {
    if (isDisposed()) return;
    for (const f of fighters) {
      f.dancer = attachDancer(f.body, gltf, f.spec.color);
    }
    // décale le repos du J2 pour que les deux ne respirent pas en miroir
    for (const f of fighters) {
      if (f.spec.idleOffset) f.dancer?.mixer.update(f.spec.idleOffset);
    }
  });
}

// ---------------------------------------------------------------- animation

/** Avance les Y Bot (J1 puis J2) de `dt` secondes. */
export function updateDancers(fighters: Fighters, dt: number): void {
  for (const f of fighters) updateDancer(f.dancer, dt);
}

/** Anime les deux combattants : chacun suit son aura ; celui qui vient de poser saute. */
export function updateFighters(fighters: Fighters, state: ArenaState, t: number, since: number, motion: Motion): void {
  const jump = burstJump(state, since, motion);
  fighters.forEach((f, i) => {
    const player = i as Player;
    const power = Math.max(AURA_IDLE, state.auraNow[player]);
    updateFighter(f, t + f.spec.timeOffset, power, state.burstP === player ? jump : 0, motion);
  });
}

/** Hauteur du saut du joueur qui vient de poser : une arche de JUMP_TIME s, plus haute si son aura est forte. */
function burstJump(state: ArenaState, since: number, motion: Motion): number {
  if (since >= JUMP_TIME) return 0;
  return Math.sin((since / JUMP_TIME) * Math.PI) * 0.6 * (0.4 + state.auraNow[state.burstP]) * motion.scale;
}

/** `power` : aura affichée (0..1), `jump` : hauteur du saut (silhouette seulement). */
function updateFighter(f: Fighter, t: number, power: number, jump: number, motion: Motion): void {
  if (f.dancer) {
    // Le Y Bot a son propre repos et sa danse : pas de saut ni de bras procéduraux.
    f.body.position.y = 0;
  } else {
    animateSilhouette(f, t, power, jump);
  }
  animateShells(f.shells, t, power);
  animateParticles(f.particles, power, motion);
  f.light.intensity = power * 12;
}

/** Respiration + saut, et bras le long du corps → levés quand l'aura monte. */
function animateSilhouette(f: Fighter, t: number, power: number, jump: number): void {
  const breathe = Math.sin(t * 2) * 0.03;
  f.body.position.y = breathe + jump;
  const lift = THREE.MathUtils.lerp(0.15, 2.7, Math.min(1, power * 1.3));
  f.armL.rotation.z = -lift + Math.sin(t * 3) * 0.05;
  f.armR.rotation.z = lift - Math.sin(t * 3) * 0.05;
}

/** Coques : opacité qui pulse, rotation alternée d'une coque à l'autre, taille qui suit l'aura. */
function animateShells(shells: THREE.Mesh[], t: number, power: number): void {
  shells.forEach((s, i) => {
    (s.material as THREE.MeshBasicMaterial).opacity = power * (0.22 - i * 0.05) * (0.85 + Math.sin(t * 6 + i) * 0.15);
    s.rotation.y = t * (0.6 + i * 0.4) * (i % 2 ? -1 : 1);
    s.scale.setScalar(0.6 + power * 0.7);
  });
}

/** Particules : plus visibles, plus grosses et plus rapides quand l'aura monte ; elles bouclent en hauteur. */
function animateParticles(particles: THREE.Points, power: number, motion: Motion): void {
  const pm = particles.material as THREE.PointsMaterial;
  pm.opacity = Math.min(1, power * 1.4);
  pm.size = 0.06 + power * 0.08;
  const pos = particles.geometry.getAttribute('position') as THREE.BufferAttribute;
  const speed = 0.01 + power * 0.06;
  for (let i = 0; i < pos.count; i++) {
    let y = pos.getY(i) + speed * motion.scale;
    if (y > PARTICLE_TOP) y = 0;
    pos.setY(i, y);
  }
  pos.needsUpdate = true;
}
