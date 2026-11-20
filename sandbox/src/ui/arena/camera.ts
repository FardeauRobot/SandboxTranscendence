/**
 * Caméra de l'arène : lente orbite, plongée vers le joueur qui vient de poser, tremblement au niveau 4.
 * Elle s'adapte à la taille du canvas (champ horizontal fixe) et au décalage de cadrage (`setFrame`).
 * Sa position de repos et le point qu'elle regarde viennent de la disposition (`layout.ts`).
 */
import * as THREE from 'three';
import type { ArenaState, Motion } from './state';
/** Champ horizontal visé (°), et bornes du champ vertical qui en découle. */
const HFOV = 70;
const FOV_MIN = 28;
const FOV_MAX = 55;
/** Durée de la plongée vers le joueur qui vient de poser (s). */
const DIVE_TIME = 1.5;

export interface ArenaCamera {
  camera: THREE.PerspectiveCamera;
  /** Position de repos (placée par `applyLayout`). */
  base: THREE.Vector3;
  /** Point regardé, centre de l'orbite (placé par `applyLayout`). */
  look: THREE.Vector3;
  /** Recul appliqué à la distance base → look : 1, plus sur écran très large. */
  pullback: number;
  /** Taille du canvas (px CSS). */
  size: { w: number; h: number };
  /** Décalage du cadrage (px CSS), voir `setFraming`. */
  framing: { x: number; y: number };
}

export function createArenaCamera(): ArenaCamera {
  return {
    camera: new THREE.PerspectiveCamera(40, 2, 0.5, 100),
    base: new THREE.Vector3(),
    look: new THREE.Vector3(),
    pullback: 1,
    size: { w: 1, h: 1 },
    framing: { x: 0, y: 0 },
  };
}

// Vecteurs de travail réutilisés à chaque frame.
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const forward = new THREE.Vector3();
const right = new THREE.Vector3();

/**
 * Place la caméra pour l'instant `t` ; `since` = temps écoulé depuis la dernière main posée (s).
 * Orbite : la position de repos tourne lentement autour de la verticale passant par `look`.
 * Plongée : on avance vers `look`, on descend, et l'on glisse vers le camp de celui qui a posé
 * (J1 à gauche de l'écran, J2 à droite).
 */
export function updateCamera(cam: ArenaCamera, state: ArenaState, t: number, since: number, motion: Motion): void {
  const { camera, base, look } = cam;
  const orbit = Math.sin(t * 0.15) * 0.25 * motion.scale;
  const zoom = since < DIVE_TIME ? Math.sin((since / DIVE_TIME) * Math.PI) * 2.2 : 0;
  camera.position.copy(base).sub(look).applyAxisAngle(Y_AXIS, orbit).multiplyScalar(cam.pullback).add(look);
  if (zoom > 0) {
    forward.copy(look).sub(camera.position).setY(0).normalize();
    right.crossVectors(forward, Y_AXIS);
    camera.position
      .addScaledVector(forward, zoom)
      .addScaledVector(right, zoom * 0.6 * (state.burstP === 0 ? -1 : 1));
    camera.position.y -= zoom * 0.4;
  }
  if (state.level > 3.5 && !motion.reduced) shake(camera);
  camera.lookAt(look);
}

/** Tremblement aléatoire de quelques centimètres. */
function shake(camera: THREE.PerspectiveCamera): void {
  camera.position.x += (Math.random() - 0.5) * 0.08;
  camera.position.y += (Math.random() - 0.5) * 0.08;
}

/**
 * Adapte la caméra à un canvas de `w` × `h` px.
 * On fixe le champ horizontal (~70°) plutôt que le vertical : sur un écran très large, la vue
 * ne s'ouvre pas jusqu'aux bords du vide ; sur un écran étroit, on garde les deux combattants.
 */
export function resizeCamera(cam: ArenaCamera, w: number, h: number): void {
  cam.camera.aspect = w / h;
  const wanted = verticalFov(w / Math.max(1, h));
  // Plancher à 28° pour ne pas zoomer sur les combattants ; on compense en reculant la caméra.
  cam.camera.fov = THREE.MathUtils.clamp(wanted, FOV_MIN, FOV_MAX);
  cam.pullback = wanted < FOV_MIN ? 1 + (FOV_MIN - wanted) / FOV_MIN * 0.6 : 1;
  cam.size = { w, h };
  applyViewOffset(cam);
}

/** Champ vertical (°) qui donne un champ horizontal de HFOV pour ce rapport largeur / hauteur. */
function verticalFov(aspect: number): number {
  const hfov = THREE.MathUtils.degToRad(HFOV);
  return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / aspect));
}

/** Décale le cadrage (px CSS) : x > 0 pousse la scène vers la gauche, y > 0 vers le haut. */
export function setFraming(cam: ArenaCamera, x: number, y: number): void {
  cam.framing = { x, y };
  applyViewOffset(cam);
}

function applyViewOffset(cam: ArenaCamera): void {
  const { camera, framing } = cam;
  const { w, h } = cam.size;
  if (framing.x || framing.y) camera.setViewOffset(w, h, framing.x, framing.y, w, h);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}
