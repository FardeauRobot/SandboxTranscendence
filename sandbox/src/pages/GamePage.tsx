// La page PARTIE. Elle ne reçoit qu'une chose : l'id lu dans l'URL (③, voir App.tsx).
// À partir de là, elle se débrouille seule :
//
//   ④ getGame(id)  → demande au serveur la partie (son seed)
//   ⑤ <Game>       → monte le jeu avec ce seed
//
// Dans Transcendence, ④ serait suivi de `socket.emit('game:join', id, ack)`, et le serveur
// enverrait l'état du match au lieu de le laisser calculer ici.

import { useEffect, useReducer, useRef, useState } from 'react';
import { matchReducer, newMatch } from '../engine/match';
import { createGame, getGame, type GameRow } from '../net/api';
import { navigate } from '../net/router';
import { useRules } from '../state/useRules';
import { RulesEditor } from '../ui/RulesEditor';
import { Table } from '../ui/Table';



// ═════════════════════════════════════════════════════════════════════════════════════════════
//  Le chargeur : id → partie
// ═════════════════════════════════════════════════════════════════════════════════════════════

type Load =
  | { state: 'loading' }
  | { state: 'missing' }
  | { state: 'error'; message: string }
  | { state: 'ready'; game: GameRow };


export function GamePage({ id }: { id: number }) {

  const [load, setLoad] = useState<Load>({ state: 'loading' });



  // ─── ④ Charger la partie dont l'id est dans l'URL ──────────────────────────────────────────
  //
  // Pas besoin de remettre `loading` quand l'id change : App.tsx pose `key={id}` sur cette page,
  // donc passer de /partie/3 à /partie/4 détruit ce composant et en crée un neuf, état compris.

  useEffect(() => {

    let cancelled = false;

    getGame(id)
      .then((game) => {
        if (cancelled) return;
        setLoad(game ? { state: 'ready', game } : { state: 'missing' });
      })
      .catch((e) => {
        if (cancelled) return;
        setLoad({ state: 'error', message: e instanceof Error ? e.message : String(e) });
      });

    return () => { cancelled = true; };
  }, [id]);



  // ─── Les trois écrans possibles ────────────────────────────────────────────────────────────

  if (load.state === 'ready') {
    return <Game game={load.game} />; // ⑤
  }

  return (
    <main className="menu">

      {load.state === 'loading' && (
        <p className="display menu-sub">Connexion à la partie n°{id}…</p>
      )}

      {load.state === 'missing' && (
        <p className="menu-error" role="alert">La partie n°{id} n'existe pas.</p>
      )}

      {load.state === 'error' && (
        <p className="menu-error" role="alert">{load.message}</p>
      )}

      {load.state !== 'loading' && (
        <button type="button" className="primary" onClick={() => navigate('/')} autoFocus>
          Retour au menu
        </button>
      )}

    </main>
  );
}



// ═════════════════════════════════════════════════════════════════════════════════════════════
//  Le jeu : l'ancien App.tsx, qui reçoit maintenant son seed du serveur
// ═════════════════════════════════════════════════════════════════════════════════════════════

const LAB_KEY = 'aura-sandbox:lab-open';
const LOCK_KEY = 'aura-sandbox:lock-seed';

const DRAWER = 440;    // largeur du labo en px, cf. .editor dans app.css
const WIDE = 1000;     // au-dessus, le labo se pose à côté de l'action ; en dessous, il la recouvre
const SIDE = 416;      // panneau de score à gauche (padding + largeur + gouttière), cf. .overlay
const SIDE_FROM = 760; // en dessous, le panneau de score passe au-dessus de l'action



// ─── Petits utilitaires ──────────────────────────────────────────────────────────────────────

function useViewportWidth() {

  const [w, setW] = useState(() => window.innerWidth);

  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  return w;
}


/** Préférence gardée dans localStorage : elle doit survivre au changement de partie (remontage). */
function readFlag(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v !== null) return v === '1';
  } catch { /* stockage indisponible */ }
  return fallback;
}

function writeFlag(key: string, v: boolean) {
  try { localStorage.setItem(key, v ? '1' : '0'); } catch { /* ignoré */ }
}



// ─── Le composant ────────────────────────────────────────────────────────────────────────────

function Game({ game }: { game: GameRow }) {

  // Les règles viennent du labo, pas du serveur : on les règle en direct pendant la partie.
  const { rules, update, reset, replace } = useRules();

  // Le seed part de celui du serveur ; seul le labo peut le changer ensuite (voir plus bas).
  const [seed, setSeed] = useState(game.seed);
  const [match, dispatch] = useReducer(matchReducer, undefined, () => newMatch(game.seed, rules));

  // Change quand le labo relance la donne sur place : remonte la table (chrono, écran « Prêt ? »).
  const [matchNo, setMatchNo] = useState(0);

  const [lockSeed, setLockSeed] = useState(() => readFlag(LOCK_KEY, false));
  const [labOpen, setLabOpen] = useState(() => readFlag(LAB_KEY, window.innerWidth >= 1200));

  const vw = useViewportWidth();
  const docked = labOpen && vw >= WIDE;



  // ─── « Nouveau match » en fin de partie : on repasse par le serveur ────────────────────────
  //
  // Exactement le parcours du menu (① créer, ② naviguer). La page actuelle sera démontée par
  // la navigation, et une page neuve chargera la nouvelle partie.

  const creating = useRef(false);

  const newGame = async () => {

    if (creating.current) return;
    creating.current = true;

    try {
      const id = await createGame(lockSeed ? seed : undefined);   // ①
      navigate(`/partie/${id}`);                                   // ②
    } catch {
      creating.current = false;
    }
  };



  // ─── Seed tapé dans le labo : on relance SUR PLACE, sans serveur ───────────────────────────
  //
  // Le champ appelle `onSeed` à chaque frappe : taper « 1234 » ferait quatre parties. Le labo est
  // un outil de réglage, pas un parcours joueur, donc il reste local. Contrepartie : un F5 revient
  // au seed d'origine de la partie, celui que le serveur a enregistré.

  const reseed = (s: number) => {
    setSeed(s);
    dispatch({ type: 'new', seed: s, rules });
    setMatchNo((x) => x + 1);
  };



  // ─── Préférences ───────────────────────────────────────────────────────────────────────────

  const toggleLab = () => {
    setLabOpen((o) => {
      writeFlag(LAB_KEY, !o);
      return !o;
    });
  };

  const changeLock = (v: boolean) => {
    writeFlag(LOCK_KEY, v);
    setLockSeed(v);
  };



  // ─── Affichage ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className={`app${labOpen ? ' lab-open' : ''}`}>

      <nav className="topbar">

        <span className="display brand">AURA</span>
        <span className="display tag">Partie n°{game.id}</span>

        <button type="button" className="ghost" onClick={() => navigate('/')}>
          Menu
        </button>

        <button type="button" className="ghost" onClick={() => { window.location.search = 'scene'; }}>
          Scène
        </button>

        <button
          type="button"
          className={`ghost lab-toggle${labOpen ? ' is-on' : ''}`}
          aria-expanded={labOpen}
          aria-controls="labo"
          onClick={toggleLab}
        >
          {labOpen ? 'Fermer le labo' : 'Le labo'}
        </button>

      </nav>


      <Table
        key={matchNo}
        rules={rules}
        match={match}
        dispatch={dispatch}
        // Centre les combattants dans l'espace libre entre le panneau de score et le labo.
        frameX={vw >= SIDE_FROM ? ((docked ? DRAWER : 0) - SIDE) / 2 : 0}
        onNewMatch={newGame}
      />


      <RulesEditor
        open={labOpen}
        rules={rules}
        update={update}
        reset={reset}
        replace={replace}
        seed={seed}
        lockSeed={lockSeed}
        onLockSeed={changeLock}
        onSeed={reseed}
      />

    </div>
  );
}
