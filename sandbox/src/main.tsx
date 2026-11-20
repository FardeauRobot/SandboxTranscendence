import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/theme.css';
import './styles/app.css';

/** `?scene` ouvre l'éditeur de scène, chargé à part pour ne pas alourdir le jeu. */
const SceneEditor = lazy(() => import('./ui/arena/editor/SceneEditor'));
const editing = new URLSearchParams(window.location.search).has('scene');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {editing ? (
      <Suspense fallback={null}>
        <SceneEditor />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
