import { useEffect, useReducer, useState } from 'react';
import { matchReducer, newMatch } from './engine/match';
import { randomSeed } from './state/seed';
import { useRules } from './state/useRules';
import { RulesEditor } from './ui/RulesEditor';
import { Table } from './ui/Table';

const LAB_KEY = 'aura-sandbox:lab-open';
const DRAWER = 440; // largeur du labo en px, cf. .editor dans app.css
const WIDE = 1000; // au-dessus, le labo se pose à côté de l'action ; en dessous, il la recouvre
const SIDE = 416; // panneau de score à gauche (padding + largeur + gouttière), cf. .overlay
const SIDE_FROM = 760; // en dessous, le panneau de score passe au-dessus de l'action

function useViewportWidth() {
  const [w, setW] = useState(() => window.innerWidth);
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}

function initialLabOpen(): boolean {
  try {
    const v = localStorage.getItem(LAB_KEY);
    if (v !== null) return v === '1';
  } catch { /* stockage indisponible */ }
  return window.innerWidth >= 1200;
}

export default function App() {
  const { rules, update, reset, replace } = useRules();
  const [seed, setSeed] = useState(randomSeed);
  const [lockSeed, setLockSeed] = useState(false);
  const [match, dispatch] = useReducer(matchReducer, undefined, () => newMatch(seed, rules));
  // Change à chaque nouveau match : remonte la table (chrono, écran « Prêt ? »).
  const [matchNo, setMatchNo] = useState(0);
  const [labOpen, setLabOpen] = useState(initialLabOpen);
  const vw = useViewportWidth();

  const toggleLab = () => {
    setLabOpen((o) => {
      try { localStorage.setItem(LAB_KEY, o ? '0' : '1'); } catch { /* ignoré */ }
      return !o;
    });
  };

  const startMatch = (s = lockSeed ? seed : randomSeed()) => {
    setSeed(s);
    dispatch({ type: 'new', seed: s, rules });
    setMatchNo((x) => x + 1);
  };

  const docked = labOpen && vw >= WIDE;

  return (
    <div className={`app${labOpen ? ' lab-open' : ''}`}>
      <nav className="topbar">
        <span className="display brand">AURA</span>
        <span className="display tag">Bac à sable · règles</span>
        <button type="button" className={`ghost lab-toggle${labOpen ? ' is-on' : ''}`} aria-expanded={labOpen} aria-controls="labo" onClick={toggleLab}>
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
        onNewMatch={() => startMatch()}
      />
      <RulesEditor
        open={labOpen}
        rules={rules}
        update={update}
        reset={reset}
        replace={replace}
        seed={seed}
        lockSeed={lockSeed}
        onLockSeed={setLockSeed}
        onSeed={(s) => startMatch(s)}
      />
    </div>
  );
}
