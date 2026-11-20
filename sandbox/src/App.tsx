// Le POSTE D'AIGUILLAGE : lit l'URL, choisit la page. C'est l'équivalent de `routes.tsx` dans le
// repo d'équipe (`{ path: '/game/:id', element: <Game /> }`).
//
// Le parcours complet, de bout en bout :
//
//   Menu.tsx       ① createGame()           → le serveur crée la partie, renvoie { id: 3 }
//   Menu.tsx       ② navigate('/partie/3')  → l'URL change, sans recharger la page
//   App.tsx        ③ matchGame(path) → 3    → on choisit la page Partie, avec l'id
//   GamePage.tsx   ④ getGame(3)             → le serveur renvoie la partie (son seed)
//   GamePage.tsx   ⑤ <Game game={…} />      → la table se monte
//
// Entre le menu et le jeu, la seule chose qui circule est l'URL.

import { useEffect } from 'react';
import { matchGame, navigate, usePath } from './net/router';
import { GamePage } from './pages/GamePage';
import { Menu } from './pages/Menu';



export default function App() {

  const path = usePath();



  // ─── ③ Quelle page pour cette URL ? ────────────────────────────────────────────────────────

  const gameId = matchGame(path);
  const known = path === '/' || gameId !== null;



  // URL inconnue (/n-importe-quoi) : on renvoie au menu. `replace` pour que « Précédent » ne
  // ramène pas sur l'URL cassée.
  useEffect(() => {
    if (!known) navigate('/', { replace: true });
  }, [known]);



  // ─── Rendu ─────────────────────────────────────────────────────────────────────────────────
  //
  // `key={gameId}` : changer d'id (fin de partie → « Nouveau match ») détruit la page et en monte
  // une neuve. Sans la key, React garderait le même composant et son état de la partie d'avant.

  if (gameId !== null) return <GamePage key={gameId} id={gameId} />;

  return <Menu />;
}
