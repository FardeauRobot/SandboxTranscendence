// Mini-routeur maison : ce que fait `react-router` dans le repo d'équipe, en une trentaine de lignes.
//
//   ici                      repo d'équipe (react-router)
//   ───────────────────────  ──────────────────────────────
//   navigate('/partie/3')    const navigate = useNavigate(); navigate('/partie/3')
//   usePath()                useLocation().pathname
//   matchGame(path)          useParams() sur la route '/game/:id'
//
// Le principe : l'URL est la source de vérité. On la change sans recharger la page
// (`history.pushState`), puis on prévient React qu'il faut redessiner.

import { useEffect, useState } from 'react';



// ─── Événement interne ───────────────────────────────────────────────────────────────────────
//
// `pushState` change l'URL mais ne déclenche AUCUN événement. On en émet un nous-mêmes,
// pour que `usePath()` sache qu'il doit se mettre à jour.

const CHANGE = 'aura:navigate';



// ─── Changer de page ─────────────────────────────────────────────────────────────────────────

export function navigate(path: string, { replace = false } = {}) {

  if (replace) {
    // Remplace l'entrée courante : le bouton « Précédent » ne reviendra pas ici.
    window.history.replaceState(null, '', path);
  } else {
    // Ajoute une entrée : « Précédent » ramènera à la page d'avant.
    window.history.pushState(null, '', path);
  }

  window.dispatchEvent(new Event(CHANGE));
}



// ─── Lire la page courante ───────────────────────────────────────────────────────────────────

/** Le chemin courant (`/`, `/partie/3`…), mis à jour à chaque navigation. */
export function usePath(): string {

  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onChange = () => setPath(window.location.pathname);

    // CHANGE : nos propres `navigate()`.
    // popstate : les boutons Précédent / Suivant du navigateur.
    window.addEventListener(CHANGE, onChange);
    window.addEventListener('popstate', onChange);

    return () => {
      window.removeEventListener(CHANGE, onChange);
      window.removeEventListener('popstate', onChange);
    };
  }, []);

  return path;
}



// ─── Reconnaître une route ───────────────────────────────────────────────────────────────────

/**
 * `/partie/42` → 42. Tout le reste → null.
 * C'est l'équivalent de la route `'/game/:id'` + `useParams()`.
 */
export function matchGame(path: string): number | null {

  const m = /^\/partie\/(\d+)\/?$/.exec(path);
  if (!m) return null;

  const id = Number(m[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
