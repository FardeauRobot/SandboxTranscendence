/** Éclairage de l'arène : ambiance, projecteurs des deux camps, douche centrale et stroboscope. */
import * as THREE from 'three';
import { BLUE, RED, YELLOW } from './config';
import type { Motion } from './state';

/** Les lumières placées par la disposition (`layout.ts`) ; certaines suivent aussi le niveau de la foule. */
export interface ArenaLights {
  /** Éclairage des tribunes, qui monte avec l'ambiance. */
  standWash: THREE.SpotLight;
  /** Projecteurs colorés des deux camps (fixes). */
  spotBlue: THREE.SpotLight;
  spotRed: THREE.SpotLight;
  /** Douche au-dessus du ring (seule lumière à porter des ombres) ; vire au jaune au niveau 3. */
  spotTop: THREE.SpotLight;
  /** Flash aléatoire au-delà du niveau 3,5 (coupé en mouvement réduit). */
  strobe: THREE.PointLight;
}

/**
 * Crée toutes les lumières et les ajoute à la scène, cibles comprises (une cible hors de la scène ne
 * suivrait pas un déplacement). Leurs positions viennent ensuite de `applyLayout`.
 */
export function createLights(scene: THREE.Scene): ArenaLights {
  scene.add(new THREE.HemisphereLight(0x8899aa, 0x222222, 1.1));
  const standWash = new THREE.SpotLight(0xfff1d0, 40, 60, 1.0, 0.8, 0.6);
  const spotBlue = createSideSpot(BLUE);
  const spotRed = createSideSpot(RED);
  const spotTop = createTopSpot();
  const strobe = new THREE.PointLight(0xffffff, 0, 40, 1);
  for (const spot of [standWash, spotBlue, spotRed, spotTop]) scene.add(spot, spot.target);
  scene.add(strobe);
  return { standWash, spotBlue, spotRed, spotTop, strobe };
}

/** Projecteur coloré d'un camp. */
function createSideSpot(color: number): THREE.SpotLight {
  return new THREE.SpotLight(color, 60, 30, 0.5, 0.6, 1.2);
}

function createTopSpot(): THREE.SpotLight {
  const spot = new THREE.SpotLight(0xffffff, 80, 30, 0.45, 0.5, 1.2);
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
