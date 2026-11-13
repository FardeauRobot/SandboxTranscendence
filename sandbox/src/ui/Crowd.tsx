import { useMemo } from 'react';
import { makeRng } from '../engine/deck';

const ROWS = [
  { y: 92, count: 30, scale: 0.7, shade: 0.35 },
  { y: 132, count: 24, scale: 0.85, shade: 0.55 },
  { y: 178, count: 19, scale: 1, shade: 0.8 },
];
const W = 1000;

interface Person {
  x: number;
  y: number;
  s: number;
  color: string;
  delay: number;
  speed: number;
  /** Seuil de 0 à 1 : la personne lève les bras quand l'excitation le dépasse. */
  hype: number;
}

export const SHOUTS = ['', 'hmm…', 'OOOH !', 'ÉNORME !', 'AURA !!!'];

function mix(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(v * k + 17 * (1 - k));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

/** La foule autour des joueurs. `level` 0 → 4 : silence → délire. `pulse` relance l'animation à chaque main posée. */
export function Crowd({ level, pulse }: { level: number; pulse: number }) {
  const people = useMemo<Person[]>(() => {
    const rng = makeRng(7);
    const out: Person[] = [];
    for (const row of ROWS) {
      const step = W / row.count;
      for (let i = 0; i < row.count; i++) {
        const x = step * (i + 0.5) + (rng() - 0.5) * step * 0.5;
        const side = x < W / 2 ? '#1B8FD6' : '#E2264D';
        out.push({
          x,
          y: row.y + (rng() - 0.5) * 8,
          s: row.scale * (0.9 + rng() * 0.2),
          color: mix(side, row.shade * (0.75 + rng() * 0.25)),
          delay: rng() * 0.6,
          speed: 0.8 + rng() * 0.5,
          hype: rng(),
        });
      }
    }
    return out;
  }, []);

  // Proportion de la foule debout, bras levés, selon le niveau.
  const raised = [0, 0.08, 0.35, 0.7, 1][level];

  return (
    <div className="crowd" data-level={level} key={pulse}>
      <svg viewBox={`0 0 ${W} 240`} preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        {level >= 4 &&
          people.slice(0, 14).map((p, i) => (
            <circle key={`f${i}`} className="flash" cx={p.x} cy={p.y - 40} r={6} style={{ animationDelay: `${p.delay * 2}s` }} />
          ))}
        {people.map((p, i) => {
          const up = p.hype < raised;
          return (
            <g
              key={i}
              className={up ? 'p p--up' : 'p'}
              transform={`translate(${p.x} ${p.y}) scale(${p.s})`}
              style={{ ['--d' as string]: `${p.delay}s`, ['--sp' as string]: `${p.speed}s`, color: p.color }}
            >
              <g className="p-body">
                {up ? (
                  <>
                    <path d="M-13 -22 L-20 -52" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
                    <path d="M13 -22 L20 -52" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
                  </>
                ) : null}
                <path d="M-16 40 L-16 -12 Q-16 -24 0 -24 Q16 -24 16 -12 L16 40 Z" fill="currentColor" />
                <circle cx="0" cy="-36" r="11" fill="currentColor" />
              </g>
            </g>
          );
        })}
      </svg>
      {level > 0 && (
        <div className="crowd-shout display" aria-live="polite">
          {SHOUTS[level]}
        </div>
      )}
    </div>
  );
}
