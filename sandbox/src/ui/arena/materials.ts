/** Matériaux et textures partagés de l'arène, et libération des ressources GPU. */
import * as THREE from 'three';

/** Matériau standard mat de l'arène ; `extra` surcharge ou complète les réglages par défaut. */
export function std(color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...extra });
}

/** Dégradé vertical (transparent en haut et en bas) pour que l'aura n'ait pas de bords nets. */
export const AURA_FADE: THREE.CanvasTexture = (() => {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, '#000'); grd.addColorStop(0.35, '#fff'); grd.addColorStop(0.85, '#fff'); grd.addColorStop(1, '#000');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(c);
})();

/** Libère les géométries et les matériaux de tout ce qui pend sous `root` (les textures partagées restent). */
export function disposeSceneResources(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose();
  });
}
