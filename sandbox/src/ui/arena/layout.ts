/**
 * Disposition de la scène : où se tiennent les combattants, les lumières (et leurs cibles) et la caméra.
 *
 * `DEFAULT_LAYOUT` est la disposition livrée. L'éditeur de scène (`?scene`) la modifie à la souris et
 * l'enregistre dans le navigateur ; le jeu relit cette version au chargement (`loadLayout`).
 * Pour qu'un placement devienne la valeur par défaut, copier le JSON de l'éditeur ici.
 *
 * Pas d'import three.js à l'exécution : ce module reste testable sans navigateur.
 */
import type { ArenaCamera } from './camera';
import type { Fighters } from './fighter';
import type { ArenaLights } from './lights';

export type Vec3 = [number, number, number];

export interface FighterPlacement {
  /** Position des pieds (y = dessus du ring). */
  pos: Vec3;
  /** Orientation autour de la verticale (rad) : 0 = face à +z. */
  rotY: number;
}

export interface SpotPlacement {
  pos: Vec3;
  /** Point visé par le projecteur. */
  target: Vec3;
}

/** Les projecteurs (lumières avec une cible). */
export const SPOT_NAMES = ['standWash', 'spotBlue', 'spotRed', 'spotTop'] as const;
export type SpotName = (typeof SPOT_NAMES)[number];

export interface SceneLayout {
  /** J1 (bleu) puis J2 (rouge). */
  fighters: [FighterPlacement, FighterPlacement];
  /** Position de repos de la caméra de jeu et point qu'elle regarde ; elle orbite autour de `look`. */
  camera: { base: Vec3; look: Vec3 };
  lights: Record<SpotName, SpotPlacement> & { strobe: { pos: Vec3 } };
}

export const DEFAULT_LAYOUT: SceneLayout = {
  fighters: [
    // face à face, légèrement tournés vers la caméra
    { pos: [-1.9, 0.3, 0], rotY: Math.PI / 2.4 },
    { pos: [1.9, 0.3, 0], rotY: -Math.PI / 2.4 },
  ],
  camera: { base: [0, 4.6, 10.5], look: [0, 1.6, 0] },
  lights: {
    standWash: { pos: [0, 16, 14], target: [0, 3, -12] },
    spotBlue: { pos: [-7, 9, 5], target: [-2, 0, 0] },
    spotRed: { pos: [7, 9, 5], target: [2, 0, 0] },
    spotTop: { pos: [0, 12, 2], target: [0, 0, 0] },
    strobe: { pos: [0, 8, -6] },
  },
};

export function cloneLayout(l: SceneLayout): SceneLayout {
  return JSON.parse(JSON.stringify(l)) as SceneLayout;
}

/**
 * Fusionne un objet inconnu (localStorage, JSON collé) avec `base` : une valeur absente, non finie
 * ou du mauvais type garde celle de `base`, une clé en trop est ignorée.
 */
export function mergeLayout(input: unknown, base: SceneLayout = DEFAULT_LAYOUT): SceneLayout {
  const out = cloneLayout(base);
  const walk = (src: unknown, dst: Record<string, unknown>) => {
    if (!src || typeof src !== 'object') return;
    for (const k of Object.keys(dst)) {
      const v = (src as Record<string, unknown>)[k];
      const d = dst[k];
      if (d && typeof d === 'object') walk(v, d as Record<string, unknown>);
      else if (typeof v === 'number' && Number.isFinite(v)) dst[k] = v;
    }
  };
  walk(input, out as unknown as Record<string, unknown>);
  return out;
}

// ---------------------------------------------------------------- enregistrement

const KEY = 'aura-sandbox:scene-layout:v1';

/** La disposition enregistrée par l'éditeur, sinon celle par défaut. */
export function loadLayout(): SceneLayout {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return mergeLayout(JSON.parse(raw));
  } catch { /* stockage indisponible ou JSON abîmé : on garde le défaut */ }
  return cloneLayout(DEFAULT_LAYOUT);
}

export function saveLayout(l: SceneLayout): void {
  try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* ignoré */ }
}

export function clearLayout(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignoré */ }
}

// ---------------------------------------------------------------- scène ↔ disposition

/** Les objets de la scène que la disposition place. */
export interface LayoutTargets {
  fighters: Fighters;
  lights: ArenaLights;
  camera: ArenaCamera;
}

/** Place les objets de la scène selon `l`. */
export function applyLayout(t: LayoutTargets, l: SceneLayout): void {
  l.fighters.forEach((p, i) => {
    const root = t.fighters[i].root;
    root.position.fromArray(p.pos);
    root.rotation.set(0, p.rotY, 0);
  });
  t.camera.base.fromArray(l.camera.base);
  t.camera.look.fromArray(l.camera.look);
  for (const name of SPOT_NAMES) {
    t.lights[name].position.fromArray(l.lights[name].pos);
    t.lights[name].target.position.fromArray(l.lights[name].target);
  }
  t.lights.strobe.position.fromArray(l.lights.strobe.pos);
}

/** Relit la disposition depuis la scène (après un déplacement à la souris), arrondie au millimètre. */
export function readLayout(t: LayoutTargets): SceneLayout {
  const v = (p: { x: number; y: number; z: number }): Vec3 => [round(p.x), round(p.y), round(p.z)];
  const spot = (name: SpotName): SpotPlacement => ({
    pos: v(t.lights[name].position),
    target: v(t.lights[name].target.position),
  });
  return {
    fighters: [0, 1].map((i) => ({
      pos: v(t.fighters[i].root.position),
      rotY: round(yaw(t.fighters[i].root.quaternion)),
    })) as SceneLayout['fighters'],
    camera: { base: v(t.camera.base), look: v(t.camera.look) },
    lights: {
      standWash: spot('standWash'),
      spotBlue: spot('spotBlue'),
      spotRed: spot('spotRed'),
      spotTop: spot('spotTop'),
      strobe: { pos: v(t.lights.strobe.position) },
    },
  };
}

function round(x: number): number {
  return Math.round(x * 1000) / 1000;
}

/**
 * Orientation autour de la verticale d'un quaternion, en rad.
 * Lue sur le vecteur +z tourné plutôt que sur `rotation.y` : au-delà de 90°, l'Euler XYZ bascule
 * en (π, π − θ, π) et `rotation.y` ne dit plus l'orientation.
 */
export function yaw(q: { x: number; y: number; z: number; w: number }): number {
  // +z tourné par q, composantes x et z seulement
  const dx = 2 * (q.x * q.z + q.w * q.y);
  const dz = 1 - 2 * (q.x * q.x + q.y * q.y);
  return Math.atan2(dx, dz);
}
