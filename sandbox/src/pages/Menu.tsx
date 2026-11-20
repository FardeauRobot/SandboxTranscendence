// Le MENU. Son seul travail : obtenir un id de partie, puis y emmener le joueur.
//
//   ① createGame()           → demande au serveur de créer la partie, reçoit son id
//   ② navigate('/partie/id') → change l'URL ; le jeu prend le relais (voir App.tsx)
//
// Le menu ne passe RIEN d'autre au jeu : pas de props, pas d'état partagé. Tout ce dont le jeu
// a besoin, il le retrouvera à partir de l'id lu dans l'URL. C'est ce qui permet au F5, au lien
// partagé et au bouton Précédent de marcher sans rien faire de spécial.

import { useEffect, useState } from 'react';
import { createGame, listGames, type GameRow } from '../net/api';
import { navigate } from '../net/router';



export function Menu() {

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<GameRow[]>([]);



  // ─── ① + ② : « Nouvelle partie » ───────────────────────────────────────────────────────────
  //
  // Dans le gestionnaire de clic, et surtout PAS dans un useEffect : en dev, StrictMode lance
  // chaque effet deux fois, et on créerait deux parties. Un clic, lui, n'arrive qu'une fois.

  const startNewGame = async () => {

    if (busy) return; // double-clic pendant que la requête est en route
    setBusy(true);
    setError(null);

    try {
      const id = await createGame();   // ① le serveur crée la partie et renvoie son id
      navigate(`/partie/${id}`);        // ② on change de page : le menu disparaît ici
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };



  // ─── Les dernières parties, pour « Reprendre » ─────────────────────────────────────────────
  //
  // Ici un useEffect est le bon outil : on LIT des données, et lire deux fois ne casse rien.
  // `cancelled` évite de mettre à jour un composant déjà démonté (si on quitte le menu avant la réponse).

  useEffect(() => {

    let cancelled = false;

    listGames()
      .then((rows) => { if (!cancelled) setRecent(rows); })
      .catch(() => { /* la liste est un bonus : sans elle, le menu marche quand même */ });

    return () => { cancelled = true; };
  }, []);



  // ─── Affichage ─────────────────────────────────────────────────────────────────────────────

  return (
    <main className="menu">

      <h1 className="display menu-title">AURA</h1>
      <p className="display menu-sub">Bac à sable · menu</p>


      <div className="menu-actions">

        <button type="button" className="primary" onClick={startNewGame} disabled={busy} autoFocus>
          {busy ? 'Création…' : 'Nouvelle partie'}
        </button>

        <button type="button" className="ghost" onClick={() => { window.location.search = 'scene'; }}>
          Éditeur de scène
        </button>

      </div>


      {error && <p className="menu-error" role="alert">{error}</p>}


      {recent.length > 0 && (
        <section className="menu-recent">

          <h2 className="display">Reprendre</h2>

          <ul>
            {recent.map((g) => (
              <li key={g.id}>
                {/* Un vrai lien : clic molette / « ouvrir dans un onglet » marchent aussi. */}
                <a
                  href={`/partie/${g.id}`}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // nouvel onglet : laisse faire le navigateur
                    e.preventDefault();
                    navigate(`/partie/${g.id}`); // ② même chemin que « Nouvelle partie », sans l'étape ①
                  }}
                >
                  Partie n°{g.id}
                  <span>{new Date(g.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                </a>
              </li>
            ))}
          </ul>

        </section>
      )}


      <p className="menu-hint">
        Ouvre la console (⌥⌘I) : chaque requête du client et chaque réponse du serveur y sont tracées.
      </p>

    </main>
  );
}
