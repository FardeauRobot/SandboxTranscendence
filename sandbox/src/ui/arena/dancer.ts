/**
 * Le danseur : le Y Bot de Mixamo (MODEL_URL), chargé en asynchrone et cloné pour chaque combattant.
 * Le GLB contient trois clips sur le même squelette : `idle` (repos, en boucle), `mocap` (Chicken Dance
 * capturée) et `keyframes` (la même, réécrite en code). Repos en boucle ; à chaque main posée,
 * fondu vers la danse jouée DANCE_REPEAT fois, puis fondu retour vers le repos.
 */
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { DANCE_CLIP, DANCE_REPEAT, FADE, IDLE_CLIP, INK, MODEL_SCALE, MODEL_URL } from './config';
import { std } from './materials';

/** Ce dont on a besoin dans le GLB chargé. */
export type DancerSource = Pick<GLTF, 'scene' | 'animations'>;

/** Un Y Bot animé : son mixer et ses deux actions (repos et danse). */
export interface Dancer {
  mixer: THREE.AnimationMixer;
  idle: THREE.AnimationAction;
  dance: THREE.AnimationAction;
}

/** Charge le GLB du Y Bot ; en cas d'échec, prévient dans la console et n'appelle pas `onLoad`. */
export function loadDancerModel(onLoad: (gltf: GLTF) => void): void {
  new GLTFLoader().load(
    MODEL_URL,
    onLoad,
    undefined,
    (err) => console.warn('[arena] Y Bot non chargé, on garde les silhouettes :', err),
  );
}

/**
 * Remplace la silhouette rangée dans `body` par un clone du Y Bot teinté de `color`, et le met au repos.
 * Les enfants déjà présents dans `body` (la silhouette) sont cachés, pas supprimés.
 */
export function attachDancer(body: THREE.Group, gltf: DancerSource, color: number): Dancer {
  const model = cloneModel(gltf.scene, color);
  body.children.forEach((c) => { c.visible = false; });
  body.add(model);
  return createDancer(model, gltf.animations);
}

/** Clone le Y Bot à l'échelle de l'arène : peau à la couleur du joueur, articulations à l'encre. */
function cloneModel(scene: THREE.Object3D, color: number): THREE.Object3D {
  const model = SkeletonUtils.clone(scene);
  model.scale.setScalar(MODEL_SCALE);
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    // Beta_Surface = la peau, Beta_Joints = les articulations
    mesh.material = mesh.name.includes('Joints') ? std(INK) : std(color);
    mesh.castShadow = true;
    mesh.frustumCulled = false; // la boîte englobante d'un mesh skinné ne suit pas l'animation
  });
  return model;
}

/** Mixer du modèle : repos lancé tout de suite, danse prête à jouer DANCE_REPEAT fois puis à rendre la main. */
function createDancer(model: THREE.Object3D, clips: THREE.AnimationClip[]): Dancer {
  const mixer = new THREE.AnimationMixer(model);
  const idle = mixer.clipAction(findClip(clips, IDLE_CLIP));
  const dance = mixer.clipAction(findClip(clips, DANCE_CLIP));
  dance.setLoop(THREE.LoopRepeat, DANCE_REPEAT);
  dance.clampWhenFinished = true;
  idle.play();
  mixer.addEventListener('finished', (e) => {
    if (e.action !== dance) return;
    returnToIdle({ mixer, idle, dance });
  });
  return { mixer, idle, dance };
}

function findClip(clips: THREE.AnimationClip[], name: string): THREE.AnimationClip {
  const c = THREE.AnimationClip.findByName(clips, name);
  if (!c) throw new Error(`clip « ${name} » absent de ${MODEL_URL}`);
  return c;
}

/** Fin de la danse : fondu (2 × FADE) vers le repos, repris depuis le début. */
function returnToIdle(d: Dancer): void {
  d.idle.reset().fadeIn(FADE * 2).play();
  d.dance.fadeOut(FADE * 2);
}

/**
 * Lance la danse (ou la relance si le joueur pose à nouveau pendant qu'il danse).
 * Renvoie false si le Y Bot n'est pas (encore) là.
 */
export function startDance(d: Dancer | undefined): boolean {
  if (!d) return false;
  d.dance.reset().setEffectiveWeight(1).fadeIn(FADE).play();
  d.idle.fadeOut(FADE);
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
