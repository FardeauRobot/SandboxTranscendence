/** Éclairage de l'arène : ambiance, projecteurs des deux camps, douche centrale et stroboscope. */
import * as THREE from 'three';
import { BLUE, RED, YELLOW } from './config';
import type { Motion } from './state';

/** Les lumières qui suivent le niveau de la foule ; les autres sont fixes. */
export interface ArenaLights {
  /** Éclairage des tribunes, qui monte avec l'ambiance. */
  standWash: THREE.SpotLight;
  /** Douche au-dessus du ring (seule lumière à porter des ombres) ; vire au jaune au niveau 3. */
  spotTop: THREE.SpotLight;
  /** Flash aléatoire au-delà du niveau 3,5 (coupé en mouvement réduit). */
  strobe: THREE.PointLight;
}

/** Crée toutes les lumières, les ajoute à la scène et renvoie celles à animer. */
export function createLights(scene: THREE.Scene): ArenaLights {
  scene.add(new THREE.HemisphereLight(0x8899aa, 0x222222, 1.1));
  const standWash = new THREE.SpotLight(0xfff1d0, 40, 60, 1.0, 0.8, 0.6);
  standWash.position.set(0, 16, 14);
  standWash.target.position.set(0, 3, -12);
  scene.add(standWash, standWash.target);
  const spotBlue = createSideSpot(BLUE, -1);
  const spotRed = createSideSpot(RED, 1);
  const spotTop = createTopSpot();
  const strobe = new THREE.PointLight(0xffffff, 0, 40, 1);
  strobe.position.set(0, 8, -6);
  scene.add(spotBlue, spotBlue.target, spotRed, spotRed.target, spotTop, strobe);
  return { standWash, spotTop, strobe };
}

/** Projecteur coloré d'un camp : `side` = -1 à gauche (J1), 1 à droite (J2). */
function createSideSpot(color: number, side: -1 | 1): THREE.SpotLight {
  const spot = new THREE.SpotLight(color, 60, 30, 0.5, 0.6, 1.2);
  spot.position.set(side * 7, 9, 5);
  spot.target.position.set(side * 2, 0, 0);
  return spot;
}

function createTopSpot(): THREE.SpotLight {
  const spot = new THREE.SpotLight(0xffffff, 80, 30, 0.45, 0.5, 1.2);
  spot.position.set(0, 12, 2);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  return spot;
}

/** Intensités et couleur selon le niveau lissé (0..4) ; le strobe tire au hasard à chaque frame. */
export function updateLights(lights: ArenaLights, level: number, motion: Motion): void {
  lights.spotTop.intensity = 40 + level * 25;
  lights.standWash.intensity = 30 + level * 22;
  lights.spotTop.color.setHex(level >= 3 ? YELLOW : 0xffffff);
  lights.strobe.intensity = level > 3.5 && !motion.reduced && Math.random() < 0.08 ? 60 : 0;
}
