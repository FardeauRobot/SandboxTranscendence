/** Sol et ring : disque coupé bleu / rouge + bande jaune, comme la DA. Décor fixe, rien à animer. */
import * as THREE from 'three';
import { YELLOW } from './config';
import { std } from './materials';

/** Hauteur du plateau du ring. */
const RING_HEIGHT = 0.3;

/** Ajoute le sol puis le ring (deux demi-disques, la bande, le liseré) à la scène. */
export function createRing(scene: THREE.Scene): void {
  scene.add(createFloor());
  for (const m of [createHalf(Math.PI, 0x0b2a40), createHalf(0, 0x40101a), createStripe()]) {
    m.position.y = RING_HEIGHT / 2;
    m.receiveShadow = true;
    scene.add(m);
  }
  scene.add(createRim());
}

/** Grand disque sombre qui reçoit les ombres. */
function createFloor(): THREE.Mesh {
  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), std(0x161616, { roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  return floor;
}

/** Demi-plateau du ring : `thetaStart` = π pour la moitié gauche (J1), 0 pour la droite (J2). */
function createHalf(thetaStart: number, color: number): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, RING_HEIGHT, 48, 1, false, thetaStart, Math.PI), std(color));
}

/** Bande jaune lumineuse qui sépare les deux moitiés, inclinée de 15°. */
function createStripe(): THREE.Mesh {
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 8.6), std(YELLOW, { emissive: YELLOW, emissiveIntensity: 0.4 }));
  stripe.rotation.y = THREE.MathUtils.degToRad(15);
  return stripe;
}

/** Liseré blanc lumineux sur le bord du plateau. */
function createRim(): THREE.Mesh {
  const rim = new THREE.Mesh(new THREE.TorusGeometry(4.35, 0.06, 8, 96), std(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.31;
  return rim;
}
