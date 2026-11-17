import { useEffect, useRef, useState } from 'react';
import { RANK_LABEL } from '../engine/deck';
import { HAND_IDS, RANKS, SUIT_IDS, type Rules } from '../engine/types';

interface NumProps {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
}

/** Champ numérique tolérant : on peut le vider en tapant, la valeur n'est appliquée que si elle est valide. */
function Num({ value, onChange, min, max, step = 1, label }: NumProps) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <input
      type="number"
      aria-label={label}
      value={draft}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value !== '' && Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max)) onChange(n);
      }}
      onBlur={() => setDraft(String(value))}
    />
  );
}

interface Props {
  open: boolean;
  rules: Rules;
  update: (fn: (r: Rules) => void) => void;
  reset: () => void;
  replace: (r: unknown) => void;
  seed: number;
  lockSeed: boolean;
  onLockSeed: (v: boolean) => void;
  onSeed: (n: number) => void;
}

export function RulesEditor({ open, rules, update, reset, replace, seed, lockSeed, onLockSeed, onSeed }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(rules, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'aura-regles.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (file: File) => {
    try {
      replace(JSON.parse(await file.text()));
      setMsg(`Importé : ${file.name}`);
    } catch {
      setMsg('Fichier illisible (JSON attendu).');
    }
  };

  return (
    <aside id="labo" className={`editor${open ? ' is-open' : ''}`} aria-label="Éditeur de règles" hidden={!open}>
      <header className="editor-head">
        <h2 className="display">Le labo</h2>
        <p className="muted">Chaque changement recalcule la main en direct.</p>
      </header>

      <details open>
        <summary className="display">Mains · points × mult</summary>
        <table className="grid">
          <thead>
            <tr><th>On</th><th>Main</th><th>Points</th><th>Mult</th></tr>
          </thead>
          <tbody>
            {[...HAND_IDS].reverse().map((id) => {
              const h = rules.hands[id];
              return (
                <tr key={id} className={h.enabled ? '' : 'off'}>
                  <td>
                    <input type="checkbox" checked={h.enabled} aria-label={`Activer ${h.label}`}
                      onChange={(e) => update((r) => { r.hands[id].enabled = e.target.checked; })} />
                  </td>
                  <td>{h.label}</td>
                  <td><Num label={`Points ${h.label}`} value={h.points} min={0} onChange={(n) => update((r) => { r.hands[id].points = n; })} /></td>
                  <td><Num label={`Mult ${h.label}`} value={h.mult} min={0} step={0.5} onChange={(n) => update((r) => { r.hands[id].mult = n; })} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>

      <details open>
        <summary className="display">Points par rang</summary>
        <div className="ranks">
          {RANKS.map((rank) => (
            <label key={rank}>
              <span className="display">{RANK_LABEL[rank]}</span>
              <Num label={`Points du ${RANK_LABEL[rank]}`} value={rules.rankPoints[rank]} min={0}
                onChange={(n) => update((r) => { r.rankPoints[rank] = n; })} />
            </label>
          ))}
        </div>
      </details>

      <details open>
        <summary className="display">Familles</summary>
        <p className="muted small">Par carte qui compte : +points, +mult, puis ×mult.</p>
        <table className="grid">
          <thead>
            <tr><th></th><th>Nom</th><th>+Points</th><th>+Mult</th><th>×Mult</th></tr>
          </thead>
          <tbody>
            {SUIT_IDS.map((id) => {
              const s = rules.suits[id];
              return (
                <tr key={id}>
                  <td>
                    <input type="color" value={s.color} aria-label={`Couleur ${s.name}`}
                      onChange={(e) => update((r) => { r.suits[id].color = e.target.value; })} />
                  </td>
                  <td>
                    <input type="text" value={s.name} aria-label={`Nom de la famille ${id}`}
                      onChange={(e) => update((r) => { r.suits[id].name = e.target.value; })} />
                  </td>
                  <td><Num label={`Points ${s.name}`} value={s.points} onChange={(n) => update((r) => { r.suits[id].points = n; })} /></td>
                  <td><Num label={`Plus mult ${s.name}`} value={s.plusMult} step={0.5} onChange={(n) => update((r) => { r.suits[id].plusMult = n; })} /></td>
                  <td><Num label={`Fois mult ${s.name}`} value={s.xMult} min={0} step={0.1} onChange={(n) => update((r) => { r.suits[id].xMult = n; })} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>

      <details open>
        <summary className="display">Partie</summary>
        <div className="pairs">
          <label>Manches <Num label="Manches" value={rules.game.rounds} min={1} max={15} onChange={(n) => update((r) => { r.game.rounds = Math.round(n); })} /></label>
          <label>Chrono (s / joueur / manche) <Num label="Chrono en secondes" value={rules.game.turnSeconds} min={5} max={300} onChange={(n) => update((r) => { r.game.turnSeconds = Math.round(n); })} /></label>
          <label>Taille de la main <Num label="Taille de la main" value={rules.game.handSize} min={1} max={20} onChange={(n) => update((r) => { r.game.handSize = Math.round(n); })} /></label>
          <label>Cartes posées max <Num label="Cartes posées max" value={rules.game.maxPlay} min={1} max={10} onChange={(n) => update((r) => { r.game.maxPlay = Math.round(n); })} /></label>
          <label>Défausses par match <Num label="Défausses par match" value={rules.game.maxDiscards} min={0} max={50} onChange={(n) => update((r) => { r.game.maxDiscards = Math.round(n); })} /></label>
          <label>Cartes par défausse <Num label="Cartes par défausse" value={rules.game.maxDiscardCards} min={1} max={10} onChange={(n) => update((r) => { r.game.maxDiscardCards = Math.round(n); })} /></label>
        </div>
        <p className="muted small">La taille de main s'applique à la prochaine manche, le nombre de manches et le chrono tout de suite.</p>
      </details>

      <details open>
        <summary className="display">Foule · paliers</summary>
        <div className="pairs">
          {rules.crowd.map((t, i) => (
            <label key={i}>Niveau {i + 1} dès <Num label={`Seuil niveau ${i + 1}`} value={t} min={0}
              onChange={(n) => update((r) => { r.crowd[i] = n; })} /></label>
          ))}
        </div>
      </details>

      <details open>
        <summary className="display">Outils</summary>
        <div className="pairs">
          <label className="row">
            <input type="checkbox" checked={lockSeed} onChange={(e) => onLockSeed(e.target.checked)} />
            Rejouer toujours les mêmes donnes
          </label>
          <label>Seed <Num label="Seed" value={seed} min={0} onChange={(n) => onSeed(Math.round(n))} /></label>
        </div>
        <div className="tools">
          <button type="button" className="ghost" onClick={exportJson}>Exporter</button>
          <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>Importer</button>
          <button type="button" className="ghost" onClick={() => { if (confirm('Revenir aux règles de base ?')) reset(); }}>Réinitialiser</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />
        </div>
        {msg && <p className="muted small" role="status">{msg}</p>}
      </details>
    </aside>
  );
}
