import type { Rules, ScoreResult } from '../engine/types';

const fmt = (n: number) => (Number.isInteger(n) ? n.toLocaleString('fr-FR') : n.toLocaleString('fr-FR', { maximumFractionDigits: 2 }));

interface Props {
  result: ScoreResult;
  rules: Rules;
  /** Score de la même main avec les règles d'au moment de la pose (comparateur). */
  before?: ScoreResult | null;
  preview: boolean;
}

export function ScorePanel({ result, rules, before, preview }: Props) {
  const handLabel = result.hand ? rules.hands[result.hand].label : '—';
  const delta = before ? result.score - before.score : 0;

  return (
    <section className="score-panel" aria-label="Calcul du score">
      <header className="score-head">
        <span className="display score-hand">{preview ? `Aperçu · ${handLabel}` : handLabel}</span>
        <div className="score-formula">
          <span className="chip chip--blue num">{fmt(result.points)}</span>
          <span className="display">×</span>
          <span className="chip chip--red num">{fmt(result.mult)}</span>
          <span className="display">=</span>
          <span className="score-total display num">{fmt(result.score)}</span>
        </div>
      </header>

      {before && delta !== 0 && (
        <p className="score-compare">
          Avec les règles au moment de la pose : <b className="num">{fmt(before.score)}</b>{' '}
          <span className={delta > 0 ? 'up' : 'down'}>
            ({delta > 0 ? '+' : ''}
            {fmt(delta)})
          </span>
        </p>
      )}

      {result.steps.length > 0 ? (
        <ol className="steps">
          {result.steps.map((s, i) => (
            <li key={i} className={`step step--${s.kind}`}>
              <span className="step-label">{s.label}</span>
              <span className="step-effect">{s.effect}</span>
              <span className="step-run num">
                {fmt(s.points)} × {fmt(s.mult)}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">Sélectionne des cartes pour voir le calcul.</p>
      )}
    </section>
  );
}
