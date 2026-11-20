// Côté CLIENT : les fonctions que les pages appellent pour parler au serveur.
//
// Dans le repo d'équipe, c'est `apps/frontend/src/lib/api.ts`. Il ferait
//   fetch('/api/v1/games', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
// et ici on appelle le faux serveur à la place. Les pages, elles, ne voient pas la différence :
// remplacer le corps de ces fonctions par un vrai `fetch` ne demanderait de toucher à aucune page.

import { handleCreateGame, handleGetGame, handleListGames, type GameRow } from './fakeServer';

export type { GameRow };



// ─── ① Créer une partie ──────────────────────────────────────────────────────────────────────

/** Demande une nouvelle partie au serveur et renvoie son id. */
export async function createGame(seed?: number): Promise<number> {

  console.info(`[client] POST /games ${seed === undefined ? '' : `{ seed: ${seed} }`}`);

  const res = await handleCreateGame({ seed });

  if (res.status !== 201) throw new Error(`Création refusée (${res.status})`);
  return res.body.id;
}



// ─── ④ Charger une partie ────────────────────────────────────────────────────────────────────

/** La partie n°id, ou null si le serveur ne la connaît pas (404). */
export async function getGame(id: number): Promise<GameRow | null> {

  console.info(`[client] GET /games/${id}`);

  const res = await handleGetGame(id);

  if (res.status === 404) return null;
  if (res.status !== 200) throw new Error(`Chargement refusé (${res.status})`);

  return res.body as GameRow;
}



// ─── Lister les dernières parties (pour « Reprendre » dans le menu) ─────────────────────────

export async function listGames(): Promise<GameRow[]> {

  console.info('[client] GET /games');

  const res = await handleListGames();
  return res.body;
}
