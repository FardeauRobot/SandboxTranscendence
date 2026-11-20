import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Les contrôles de l'éditeur de scène (chargé à part) : déclarés d'avance, sinon Vite les découvre
  // au premier `?scene`, ré-optimise et recharge la page avec deux copies de three.js.
  optimizeDeps: {
    include: ['three/examples/jsm/controls/OrbitControls.js', 'three/examples/jsm/controls/TransformControls.js'],
  },
});
