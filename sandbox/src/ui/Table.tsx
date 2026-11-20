import { lazy, Suspense, useEffect, useState, type Dispatch } from 'react';
import { matchOver, roundDone, total, winner, type MatchAction, type MatchState, type PlayerId } from '../engine/match';
import { crowdLevel, scoreHand } from '../engine/score';
import type { Card as CardT, Rules } from '../engine/types';
import { danceFor } from './arena/dances';
import { Card } from './Card';
import { Crowd } from './Crowd';
import { ScorePanel } from './ScorePanel';

// three.js pèse ~500 ko : chargé à part, la foule 2D s'affiche le temps qu'il arrive.
const Arena3D = lazy(() => import('./arena/Arena3D'));

const NAMES = ['Joueur 1', 'Joueur 2'] as const;
const fmt = (n: number) => n.toLocaleString('fr-FR');

interface Props {
  rules: Rules;
  match: MatchState;
  dispatch: Dispatch<MatchAction>;
  frameX: number;
  onNewMatch: () => void;
}

/**
 * Un seul écran pour deux joueurs : on joue à tour de rôle, avec un écran « Prêt ? » entre les deux
 * pour ne pas voir la main de l'autre. Le moteur, lui, laisse chaque joueur jouer indépendamment
 * (en réseau, les deux joueront en même temps sur leur appareil).
 */
export function Table({ rules, match, dispatch, frameX, onNewMatch }: Props) {
  const { maxPlay, maxDiscards, maxDiscardCards, rounds, turnSeconds } = rules.game;
  const [turn, setTurn] = useState<{ p: PlayerId; round: number; deadline: number } | null>(null);
  const [showing, setShowing] = useState<PlayerId | null>(null);
  const [pulse, setPulse] = useState(0);
  const [pulseBy, setPulseBy] = useState<PlayerId>(0);
  const [now, setNow] = useState(() => Date.now());

  // Qui commence alterne à chaque manche.
  const first = (match.round % 2) as PlayerId;
  const order: PlayerId[] = [first, (1 - first) as PlayerId];
  const active = order.find((p) => match.players[p].played === null) ?? null;
  const done = roundDone(match);
  const over = matchOver(match, rules);

  const mode: 'ready' | 'turn' | 'result' | 'round' =
    showing !== null ? 'result'
    : active === null ? 'round'
    : turn && turn.p === active && turn.round === match.round ? 'turn'
    : 'ready';

  const commit = (p: PlayerId, type: 'play' | 'timeout') => {
    dispatch({ type, p, rules });
    setTurn(null);
    setShowing(p);
    setPulseBy(p);
    setPulse((x) => x + 1);
  };

  // Chrono du joueur actif.
  useEffect(() => {
    if (mode !== 'turn') return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [mode]);
  const left = turn ? Math.max(0, Math.ceil((turn.deadline - now) / 1000)) : turnSeconds;
  useEffect(() => {
    if (mode === 'turn' && turn && now >= turn.deadline) commit(turn.p, 'timeout');
  });

  const start = () => {
    if (active === null) return;
    const t = Date.now();
    setNow(t);
    setTurn({ p: active, round: match.round, deadline: t + turnSeconds * 1000 });
  };

  // Ce qu'on montre dans le panneau de calcul.
  const me = mode === 'turn' && active !== null ? match.players[active] : null;
  const selectedCards = me ? me.selected.map((id) => me.hand.find((c) => c.id === id)!).filter(Boolean) : [];
  const shownP: PlayerId | null = mode === 'result' ? showing : mode === 'turn' ? active : null;
  const shownPl = shownP !== null ? match.players[shownP] : null;
  const shown: CardT[] = mode === 'result' ? shownPl?.played ?? [] : selectedCards.slice(0, maxPlay);
  const result = scoreHand(shown, rules);
  // La danse de la main qui vient d'être posée (lue par l'arène à chaque `pulse`).
  const dance = mode === 'result' ? danceFor(result.hand, shown) : null;
  const before = mode === 'result' && shownPl?.rulesAtPlay ? scoreHand(shown, shownPl.rulesAtPlay) : null;

  const roundScore = (p: PlayerId) => (match.players[p].played ? match.players[p].scores[match.round] ?? 0 : 0);
  const level =
    mode === 'result' ? crowdLevel(result.score, rules.crowd)
    : mode === 'round' ? crowdLevel(Math.max(roundScore(0), roundScore(1)), rules.crowd)
    : 0;
  const auras: [number, number] = [
    Math.min(1, roundScore(0) / Math.max(1, rules.crowd[3])),
    Math.min(1, roundScore(1) / Math.max(1, rules.crowd[3])),
  ];

  const totals = match.players.map(total);
  const best = Math.max(1, ...totals);
  const win = winner(match, rules);

  const n = me?.selected.length ?? 0;
  const discardsLeft = me ? Math.max(0, maxDiscards - me.discardsUsed) : 0;
  const canDiscard = !!me && n > 0 && n <= maxDiscardCards && discardsLeft > 0 && me.drawPile.length >= n;
  const canPlay = !!me && n > 0 && n <= maxPlay;
  const maxSelect = Math.max(maxPlay, maxDiscardCards);
  const fraction = mode === 'turn' && turn ? Math.max(0, (turn.deadline - now) / (turnSeconds * 1000)) : 1;

  return (
    <main className="stage" data-level={level}>
      <div className="stage-bg" aria-hidden="true" />
      <Suspense fallback={<Crowd level={level} pulse={pulse} />}>
        <Arena3D level={level} auras={auras} pulse={pulse} pulseBy={pulseBy} dance={dance} frameX={frameX} frameY={70} />
      </Suspense>

      <div className="overlay">
        <div className="hud">
          {([0, 1] as const).map((p) => (
            <div key={p} className={`aura aura--p${p + 1}${active === p && mode === 'turn' ? ' is-active' : ''}`}>
              <div className="aura-label display">
                <span>{NAMES[p]}</span>
                <b className="num">{fmt(totals[p])}</b>
              </div>
              <div className="aura-bar"><div style={{ width: `${(totals[p] / best) * 100}%` }} /></div>
              <div className="aura-sub display">
                Défausses <b className="num">{Math.max(0, maxDiscards - match.players[p].discardsUsed)}/{maxDiscards}</b>
              </div>
            </div>
          ))}
          <div className="clock display">
            <div className="clock-round">Manche <b className="num">{Math.min(match.round + 1, rounds)}/{rounds}</b></div>
            <div className={`clock-time num${mode === 'turn' ? (left <= 5 ? ' is-low' : '') : ' is-idle'}`}>
              0:{String(mode === 'turn' ? left : turnSeconds).padStart(2, '0')}
            </div>
            <div className="clock-bar"><div style={{ width: `${fraction * 100}%` }} /></div>
          </div>
        </div>

        <section className="felt">
          <Scoreboard match={match} rounds={rounds} />
          {(mode === 'turn' || mode === 'result') && shownP !== null && (
            <>
              <div className={`felt-who display p${shownP + 1}`}>
                {NAMES[shownP]}{mode === 'result' && shownPl?.timedOut ? ' · temps écoulé' : ''}
              </div>
              <div className="played-row" aria-label="Cartes posées">
                {shown.length === 0 ? (
                  <p className="hint display">{mode === 'turn' ? `Choisis jusqu'à ${maxPlay} cartes` : 'Aucune carte posée : 0'}</p>
                ) : (
                  shown.map((c) => (
                    <Card key={c.id} card={c} suit={rules.suits[c.suit]} scoring={result.scoringIds.includes(c.id)} dimmed={!result.scoringIds.includes(c.id)} />
                  ))
                )}
              </div>
              <ScorePanel result={result} rules={rules} before={before} preview={mode === 'turn'} />
            </>
          )}
          {mode === 'round' && <RoundRecap match={match} rules={rules} />}
        </section>

        <section className="hand-zone">
          {mode === 'turn' && me && active !== null ? (
            <>
              <div className="hand" aria-label={`Main de ${NAMES[active]}`}>
                {me.hand.map((c) => {
                  const idx = me.selected.indexOf(c.id);
                  return (
                    <Card
                      key={c.id}
                      card={c}
                      suit={rules.suits[c.suit]}
                      selected={idx >= 0}
                      order={idx >= 0 ? idx + 1 : undefined}
                      onClick={() => dispatch({ type: 'toggle', p: active, id: c.id, max: maxSelect })}
                    />
                  );
                })}
              </div>
              <div className="actions">
                <button type="button" className="ghost" onClick={() => dispatch({ type: 'sort', p: active, by: 'rank' })}>Trier rang</button>
                <button type="button" className="ghost" onClick={() => dispatch({ type: 'sort', p: active, by: 'suit' })}>Trier famille</button>
                <span className="spacer" />
                <span className="discard-group">
                  <span className={`discard-left display num${discardsLeft === 0 ? ' is-empty' : ''}`} aria-label={`${discardsLeft} défausses restantes sur ${maxDiscards}`}>
                    {discardsLeft}/{maxDiscards}
                  </span>
                  <button type="button" className="blue" disabled={!canDiscard} onClick={() => dispatch({ type: 'discard', p: active, rules })}>
                    Défausser{n > 0 ? ` (${n})` : ''}
                  </button>
                </span>
                <button type="button" className="primary" disabled={!canPlay} onClick={() => commit(active, 'play')}>
                  Poser{n > 0 ? ` (${Math.min(n, maxPlay)})` : ''}
                </button>
              </div>
              {n > maxPlay && <p className="warn">Plus de {maxPlay} cartes : tu peux défausser, pas poser.</p>}
            </>
          ) : (
            <div className={`gate${mode === 'ready' && active !== null ? ` p${active + 1}` : ''}`}>
              {mode === 'ready' && active !== null && (
                <>
                  <div className="gate-title display">Manche {match.round + 1} · {NAMES[active]}</div>
                  <p className="gate-text">{turnSeconds} secondes pour choisir, défausser et poser. L'autre joueur regarde ailleurs !</p>
                  <button type="button" className="primary" onClick={start} autoFocus>C'est parti</button>
                </>
              )}
              {mode === 'result' && (
                <button type="button" className="primary" onClick={() => setShowing(null)} autoFocus>
                  {active !== null ? `Au tour de ${NAMES[active]}` : 'Bilan de la manche'}
                </button>
              )}
              {mode === 'round' && (over ? (
                <>
                  <div className={`gate-title display${win !== null ? ` p${win + 1}` : ''}`}>
                    {win === null ? 'Égalité !' : `${NAMES[win]} gagne !`} {fmt(totals[0])} – {fmt(totals[1])}
                  </div>
                  <button type="button" className="primary" onClick={onNewMatch} autoFocus>Nouveau match</button>
                </>
              ) : (
                <button type="button" className="primary" disabled={!done} onClick={() => dispatch({ type: 'nextRound', rules })} autoFocus>
                  Manche {match.round + 2}
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Scoreboard({ match, rounds }: { match: MatchState; rounds: number }) {
  return (
    <table className="scoreboard" aria-label="Scores par manche">
      <thead>
        <tr>
          <th />
          {Array.from({ length: rounds }, (_, r) => (
            <th key={r} className={r === match.round ? 'is-now' : ''}>M{r + 1}</th>
          ))}
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {([0, 1] as const).map((p) => (
          <tr key={p} className={`p${p + 1}`}>
            <th className="display">J{p + 1}</th>
            {Array.from({ length: rounds }, (_, r) => {
              const s = match.players[p].scores[r];
              return <td key={r} className="num">{s === undefined ? '·' : fmt(s)}</td>;
            })}
            <td className="num"><b>{fmt(total(match.players[p]))}</b></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RoundRecap({ match, rules }: { match: MatchState; rules: Rules }) {
  const s = ([0, 1] as const).map((p) => match.players[p].scores[match.round] ?? 0);
  const lead = s[0] === s[1] ? null : s[0] > s[1] ? 0 : 1;
  return (
    <div className="recap">
      <div className="display recap-title">
        Manche {match.round + 1} · {lead === null ? 'égalité' : `${NAMES[lead]} la remporte`}
      </div>
      {([0, 1] as const).map((p) => {
        const pl = match.players[p];
        const res = scoreHand(pl.played ?? [], rules);
        const what = pl.played?.length ? (res.hand ? rules.hands[res.hand].label : '—') : 'rien posé';
        return (
          <div key={p} className={`recap-row p${p + 1}`}>
            <span className="display">{NAMES[p]}</span>
            <span className="muted">{what}{pl.timedOut ? ' · temps écoulé' : ''}</span>
            <b className="num">{fmt(s[p])}</b>
          </div>
        );
      })}
    </div>
  );
}
