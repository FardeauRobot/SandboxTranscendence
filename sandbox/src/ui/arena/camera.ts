/**
 * Caméra de l'arène : lente orbite, plongée vers le joueur qui vient de poser, tremblement au niveau 4.
 * Elle s'adapte à la taille du canvas (champ horizontal fixe) et au décalage de cadrage (`setFrame`).
 */
import * as THREE from 'three';
import type { ArenaState, Motion } from './state';

/** Position de repos de la caméra et point qu'elle regarde. */
const CAM_BASE = new THREE.Vector3(0, 4.6, 10.5);
const LOOK = new THREE.Vector3(0, 1.6, 0);
/** Champ horizontal visé (°), et bornes du champ vertical qui en découle. */
const HFOV = 70;
const FOV_MIN = 28;
const FOV_MAX = 55;
/** Durée de la plongée vers le joueur qui vient de poser (s). */
const DIVE_TIME = 1.5;

export interface ArenaCamera {
  camera: THREE.PerspectiveCamera;
  /** Distance au centre : CAM_BASE.z, sauf sur écran très large où l'on recule. */
  distance: number;
  /** Taille du canvas (px CSS). */
  size: { w: number; h: number };
  /** Décalage du cadrage (px CSS), voir `setFraming`. */
  framing: { x: number; y: number };
}

export function createArenaCamera(): ArenaCamera {
  return {
    camera: new THREE.PerspectiveCamera(40, 2, 0.5, 100),
    distance: CAM_BASE.z,
    size: { w: 1, h: 1 },
    framing: { x: 0, y: 0 },
  };
}

/** Place la caméra pour l'instant `t` ; `since` = temps écoulé depuis la dernière main posée (s). */
export function updateCamera(cam: ArenaCamera, state: ArenaState, t: number, since: number, motion: Motion): void {
  const { camera, distance } = cam;
  const orbit = Math.sin(t * 0.15) * 0.25 * motion.scale;
  const zoom = since < DIVE_TIME ? Math.sin((since / DIVE_TIME) * Math.PI) * 2.2 : 0;
  camera.position.set(
    CAM_BASE.x + Math.sin(orbit) * distance - zoom * 0.6 * (state.burstP === 0 ? 1 : -1),
    CAM_BASE.y * (distance / CAM_BASE.z) - zoom * 0.4,
    Math.cos(orbit) * distance - zoom,
  );
  if (state.level > 3.5 && !motion.reduced) shake(camera);
  camera.lookAt(LOOK);
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
  cam.distance = wanted < FOV_MIN ? CAM_BASE.z * (1 + (FOV_MIN - wanted) / FOV_MIN * 0.6) : CAM_BASE.z;
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
