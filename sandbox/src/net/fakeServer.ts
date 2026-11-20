// Le FAUX SERVEUR. Dans Transcendence, ce fichier serait le backend Adonis :
//
//   ici                      repo d'équipe
//   ───────────────────────  ─────────────────────────────────────────────────────
//   handleCreateGame()       router.post('games', [controllers.Games, 'store'])
//   handleGetGame()          router.get('games/:id', [controllers.Games, 'show'])
//   la Map `db`              la table `games` (PostgreSQL)
//
// Le front n'importe JAMAIS ce fichier directement : il passe par `api.ts`, comme il passerait
// par `fetch()`. C'est cette frontière qu'on veut rendre visible.
//
// Ce qu'on ne simule pas ici : le WebSocket. Une fois la partie chargée, elle se joue en local
// (les deux joueurs sur le même écran). En réseau, l'étape suivante serait `game:join`.

import { randomSeed } from '../state/seed';



// ─── Ce que stocke le serveur ────────────────────────────────────────────────────────────────

export interface GameRow {
  id: number;
  /** Graine du mélange. C'est le SERVEUR qui la choisit : un client ne doit pas pouvoir truquer la donne. */
  seed: number;
  createdAt: number;
}



// ─── La « base de données » ──────────────────────────────────────────────────────────────────
//
// Une Map en mémoire, recopiée dans localStorage. Sans ça, un F5 sur /partie/3 effacerait la
// partie, alors que la promesse de l'URL est justement de survivre au rechargement.
//
// On ne garde que le seed, pas l'avancement : un F5 relance la partie à la manche 1, avec la
// même donne. Un vrai serveur garderait aussi l'état du match.

const DB_KEY = 'aura-sandbox:fake-db:v1';

const db = new Map<number, GameRow>();
let nextId = 1;

/**
 * Relit la base depuis localStorage. Appelé au début de CHAQUE requête : deux onglets = deux
 * clients, mais un seul serveur. Sans ça, chaque onglet garderait sa copie et ils se
 * marcheraient dessus (deux parties n°4, l'une écrasant l'autre).
 */
function loadDb() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    const rows = raw ? (JSON.parse(raw) as GameRow[]) : [];

    db.clear();
    nextId = 1;

    for (const row of rows) {
      db.set(row.id, row);
      nextId = Math.max(nextId, row.id + 1);
    }
  } catch {
    /* stockage indisponible (tests) ou corrompu : on garde ce qu'on a en mémoire */
  }
}

function saveDb() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify([...db.values()]));
  } catch {
    /* ignoré */
  }
}



// ─── Le « réseau » ───────────────────────────────────────────────────────────────────────────
//
// Une vraie requête prend du temps et ne transporte que du texte (JSON). On imite les deux :
//   - un délai, pour voir l'écran « Connexion… » ;
//   - un aller-retour JSON, pour qu'aucun objet ne soit partagé entre « client » et « serveur ».

const LATENCY_MS = 350;

export interface Response<T> {
  status: number;
  body: T;
}

async function wire<T>(status: number, body: T): Promise<Response<T>> {
  await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
  return { status, body: JSON.parse(JSON.stringify(body)) as T };
}



// ─── Les routes ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/games  →  201 { id }
 *
 * Le client PEUT proposer un seed (le labo s'en sert pour rejouer une donne). Un vrai serveur
 * l'ignorerait en partie classée.
 */
export async function handleCreateGame(body: { seed?: number }): Promise<Response<{ id: number }>> {

  loadDb();

  const seed = typeof body.seed === 'number' && Number.isSafeInteger(body.seed) ? body.seed : randomSeed();

  const row: GameRow = { id: nextId++, seed, createdAt: Date.now() };
  db.set(row.id, row);
  saveDb();

  console.info(`%c[serveur] POST /games → 201 { id: ${row.id} }  (seed ${seed})`, 'color:#ffd23f');

  return wire(201, { id: row.id });
}


/** GET /api/v1/games/:id  →  200 { partie }  ou  404 */
export async function handleGetGame(id: number): Promise<Response<GameRow | { error: string }>> {

  loadDb();

  const row = db.get(id);

  if (!row) {
    console.info(`%c[serveur] GET /games/${id} → 404`, 'color:#e2264d');
    return wire(404, { error: `La partie n°${id} n'existe pas.` });
  }

  console.info(`%c[serveur] GET /games/${id} → 200`, 'color:#ffd23f');
  return wire(200, row);
}


/** GET /api/v1/games  →  200 [ les 5 dernières parties ] */
export async function handleListGames(): Promise<Response<GameRow[]>> {

  loadDb();

  const rows = [...db.values()].sort((a, b) => b.id - a.id).slice(0, 5);

  console.info(`%c[serveur] GET /games → 200 (${rows.length})`, 'color:#ffd23f');
  return wire(200, rows);
}
