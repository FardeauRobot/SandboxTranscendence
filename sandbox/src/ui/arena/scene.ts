/**
 * Arène 3D de la battle d'aura, en three.js pur (pas de React ici).
 *
 * Ce fichier assemble les morceaux et tient la boucle de rendu ; chaque partie vit dans son module :
 * - `config.ts`    : couleurs, réglages de la danse, des combattants, de la foule et des tribunes ;
 * - `layout.ts`    : la disposition (combattants, lumières, caméra), modifiable dans l'éditeur de scène ;
 * - `state.ts`     : l'état partagé (niveau, auras, dernière main posée), lissé à chaque frame ;
 * - `ring.ts`      : sol et ring ;
 * - `stands.ts`, `crowd.ts` : tribunes et foule instanciée ;
 * - `fighter.ts`   : les combattants (silhouette + aura), `dancer.ts` : le Y Bot qui danse ;
 * - `lights.ts`, `camera.ts` : lumières et caméra ;
 * - `materials.ts` : matériaux partagés et libération des ressources.
 *
 * Pilotage depuis l'extérieur : `setLevel(0..4)`, `setAura(joueur, 0..1)`, `burst(joueur, danse)` (à chaque main posée).
 * `rig` donne accès aux objets three.js : réservé à l'éditeur de scène (`editor/`).
 */
import * as THREE from 'three';
import { createArenaCamera, resizeCamera, setFraming, updateCamera } from './camera';
import { INK } from './config';
import { createCrowd, updateCrowd } from './crowd';
import { startDance, stopDancer } from './dancer';
import type { DanceId } from './dances';
import { createFighters, equipDancers, updateDancers, updateFighters, type Fighters } from './fighter';
import { applyLayout, DEFAULT_LAYOUT, type SceneLayout } from './layout';
import { createLights, updateLights, type ArenaLights } from './lights';
import { disposeSceneResources } from './materials';
import { createRing } from './ring';
import type { ArenaCamera } from './camera';
import {
  createArenaState, createMotion, recordBurst, setAuraTarget, setTargetLevel, sinceBurst, smoothState,
  type Player,
} from './state';

export interface Arena {
  setLevel(level: number): void;
  /** Aura d'un combattant (0 = J1 bleu, 1 = J2 rouge), 0..1. */
  setAura(player: Player, v: number): void;
  /** Un combattant vient de poser : il danse (ou saute, sans Y Bot), la caméra plonge vers lui. */
  /** Une main posée : saut, caméra, et la danse de cette main (null : pas de danse). */
  burst(player: Player, dance: DanceId | null): void;
  resize(w: number, h: number): void;
  /** Décale le cadrage (px CSS) : x > 0 pousse la scène vers la gauche, y > 0 vers le haut. */
  setFrame(x: number, y: number): void;
  dispose(): void;
  /** Les objets three.js de l'arène, pour l'éditeur de scène. */
  readonly rig: ArenaRig;
}

/** L'intérieur de l'arène, tel que l'éditeur de scène le manipule. */
export interface ArenaRig {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: ArenaCamera;
  fighters: Fighters;
  lights: ArenaLights;
  /** Caméra de rendu ; null = la caméra de jeu. L'éditeur y met sa caméra libre. */
  view: THREE.Camera | null;
  /** Appelé à chaque frame juste avant le rendu (l'éditeur y met à jour ses repères). */
  beforeRender: (() => void) | null;
}

/** Pas de temps maximal d'une frame (s) : évite les sauts après un onglet en arrière-plan. */
const MAX_DT = 0.05;

function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  return renderer;
}

function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(INK);
  scene.fog = new THREE.Fog(INK, 24, 48);
  return scene;
}

export function createArena(
  canvas: HTMLCanvasElement,
  reducedMotion: boolean,
  layout: SceneLayout = DEFAULT_LAYOUT,
): Arena {
  // ---- Construction (l'ordre compte : il fixe les identifiants three.js, donc l'ordre de tri au rendu)
  const renderer = createRenderer(canvas);
  const scene = createScene();
  const cam = createArenaCamera();
  const lights = createLights(scene);
  createRing(scene);
  const fighters = createFighters(scene);
  let disposed = false;
  equipDancers(fighters, () => disposed);
  const crowd = createCrowd(scene);
  applyLayout({ fighters, lights, camera: cam }, layout);
  const rig: ArenaRig = { renderer, scene, camera: cam, fighters, lights, view: null, beforeRender: null };

  // ---- État piloté de l'extérieur, lissé à chaque frame
  const state = createArenaState();
  const motion = createMotion(reducedMotion);
  const clock = new THREE.Clock();

  let raf = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), MAX_DT);
    const t = clock.elapsedTime;
    smoothState(state, dt);
    const since = sinceBurst(state, t);
    updateDancers(fighters, dt);
    updateCrowd(crowd, t, state.level, motion);
    updateFighters(fighters, state, t, since, motion);
    updateLights(lights, state.level, motion);
    updateCamera(cam, state, t, since, motion);
    rig.beforeRender?.();
    renderer.render(scene, rig.view ?? cam.camera);
  }
  frame();

  return {
    setLevel(l) { setTargetLevel(state, l); },
    setAura(p, a) { setAuraTarget(state, p, a); },
    burst(p, dance) {
      recordBurst(state, p, clock.elapsedTime);
      if (dance) startDance(fighters[p].dancer, dance);
    },
    resize(w, h) {
      renderer.setSize(w, h, false);
      resizeCamera(cam, w, h);
    },
    setFrame(x, y) { setFraming(cam, x, y); },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      for (const f of fighters) stopDancer(f.dancer);
      disposeSceneResources(scene);
      renderer.dispose();
    },
    rig,
  };
}
