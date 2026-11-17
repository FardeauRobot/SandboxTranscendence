/** Vrai si le navigateur sait créer un contexte WebGL (2 ou 1) ; sinon `Arena3D` affiche la foule 2D. */
export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
