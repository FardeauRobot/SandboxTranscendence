/**
 * Le danseur : un corps skinné sur le squelette Mixamo, animé par les clips de MODEL_URL.
 * MODEL_URL contient, sur ce squelette, le Y Bot, `idle` (repos, en boucle) et une danse par main (`dances.ts`).
 * Le corps est soit ce Y Bot teinté, soit une apparence (SKINS, ex. Volt) : un autre GLB riggé sur les mêmes
 * os, sans clips. Comme le mixer relie les pistes aux os par leur nom, les clips du Y Bot s'appliquent tels quels.
 * Repos en boucle ; à chaque main posée, fondu vers la danse de cette main jouée DANCE_REPEAT fois,
 * puis fondu retour vers le repos.
 */
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { DANCE_REPEAT, FADE, IDLE_CLIP, INK, MODEL_SCALE, MODEL_URL } from './config';
import { DANCE_IDS, type DanceId } from './dances';
import { std } from './materials';

/** Un Y Bot animé : son mixer, le repos, une action par danse et celle en cours. */
export interface Dancer {
  mixer: THREE.AnimationMixer;
  idle: THREE.AnimationAction;
  dances: Map<DanceId, THREE.AnimationAction>;
  /** La danse qui joue, null au repos. */
  current: THREE.AnimationAction | null;
}

/** Charge le GLB du Y Bot et des danses ; en cas d'échec, prévient dans la console et n'appelle pas `onLoad`. */
export function loadDancerModel(onLoad: (gltf: GLTF) => void): void {
  new GLTFLoader().load(
    MODEL_URL,
    onLoad,
    undefined,
    (err) => console.warn('[arena] Y Bot non chargé, on garde les silhouettes :', err),
  );
}

/** Charge le GLB d'une apparence (SKINS) ; en cas d'échec, prévient et appelle `onError`. */
export function loadSkin(url: string, onLoad: (gltf: GLTF) => void, onError: () => void): void {
  new GLTFLoader().load(url, onLoad, undefined, (err) => {
    console.warn(`[arena] apparence ${url} non chargée, on garde le Y Bot :`, err);
    onError();
  });
}

/**
 * Remplace la silhouette rangée dans `body` par un clone de `scene` animé par `clips`, et le met au repos.
 * `tint` : teinte le Y Bot à la couleur du joueur ; absent, l'apparence garde ses propres matériaux.
 * Les enfants déjà présents dans `body` (la silhouette) sont cachés, pas supprimés.
 */
export function attachDancer(
  body: THREE.Group, scene: THREE.Object3D, clips: THREE.AnimationClip[], tint?: number,
): Dancer {
  const model = cloneModel(scene, tint);
  body.children.forEach((c) => { c.visible = false; });
  body.add(model);
  return createDancer(model, clips);
}

/** Clone le corps à l'échelle de l'arène. Avec `tint` (Y Bot) : peau à la couleur du joueur, articulations à l'encre. */
function cloneModel(scene: THREE.Object3D, tint?: number): THREE.Object3D {
  const model = SkeletonUtils.clone(scene);
  model.scale.setScalar(MODEL_SCALE);
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    // Beta_Surface = la peau, Beta_Joints = les articulations
    if (tint !== undefined) mesh.material = mesh.name.includes('Joints') ? std(INK) : std(tint);
    mesh.castShadow = true;
    mesh.frustumCulled = false; // la boîte englobante d'un mesh skinné ne suit pas l'animation
  });
  return model;
}

/** Mixer du modèle : repos lancé tout de suite, chaque danse prête à jouer DANCE_REPEAT fois puis à rendre la main. */
function createDancer(model: THREE.Object3D, clips: THREE.AnimationClip[]): Dancer {
  const mixer = new THREE.AnimationMixer(model);
  const idle = mixer.clipAction(findClip(clips, IDLE_CLIP));
  const dances = new Map<DanceId, THREE.AnimationAction>();
  for (const id of DANCE_IDS) {
    const clip = THREE.AnimationClip.findByName(clips, id);
    if (!clip) {
      console.warn(`[arena] clip « ${id} » absent de ${MODEL_URL} : cette main ne dansera pas`);
      continue;
    }
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, DANCE_REPEAT);
    action.clampWhenFinished = true;
    dances.set(id, action);
  }
  idle.play();
  const d: Dancer = { mixer, idle, dances, current: null };
  mixer.addEventListener('finished', (e) => {
    if (e.action === d.current) returnToIdle(d);
  });
  return d;
}

function findClip(clips: THREE.AnimationClip[], name: string): THREE.AnimationClip {
  const c = THREE.AnimationClip.findByName(clips, name);
  if (!c) throw new Error(`clip « ${name} » absent de ${MODEL_URL}`);
  return c;
}

/** Fin de la danse : fondu (2 × FADE) vers le repos, repris depuis le début. */
function returnToIdle(d: Dancer): void {
  d.idle.reset().fadeIn(FADE * 2).play();
  d.current?.fadeOut(FADE * 2);
  d.current = null;
}

/**
 * Lance la danse `id` (ou la relance, ou passe à une autre si le joueur pose à nouveau pendant qu'il danse).
 * Renvoie false si le Y Bot n'est pas (encore) là ou si ce clip manque.
 */
export function startDance(d: Dancer | undefined, id: DanceId): boolean {
  const next = d?.dances.get(id);
  if (!d || !next) return false;
  const prev = d.current;
  next.reset().setEffectiveWeight(1).fadeIn(FADE).play();
  if (prev && prev !== next) prev.fadeOut(FADE);
  d.idle.fadeOut(FADE);
  d.current = next;
  return true;
}

/** Avance l'animation du Y Bot de `dt` secondes (rien si le modèle n'est pas chargé). */
export function updateDancer(d: Dancer | undefined, dt: number): void {
  d?.mixer.update(dt);
}

/** Arrête toutes les actions (à la libération de l'arène). */
export function stopDancer(d: Dancer | undefined): void {
  d?.mixer.stopAllAction();
}
