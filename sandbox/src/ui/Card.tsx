import type { ReactNode } from 'react';
import { RANK_LABEL } from '../engine/deck';
import type { Card as CardT, Rank, SuitId, SuitRule } from '../engine/types';

interface Props {
  card: CardT;
  suit: SuitRule;
  selected?: boolean;
  scoring?: boolean;
  dimmed?: boolean;
  order?: number;
  onClick?: () => void;
}

/* DA tarot (cf. « Two of Fucks » du moodboard Miro) : bordure à la couleur de la famille, cadre noir épais, cartouche numéral en haut,
   ciel pastel, bandeau titre en bas. SVG plat, sans <defs> : pas d'id à dédoublonner entre 8+ cartes. */

const ROMAN: Record<Rank, string> = {
  2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X',
  11: 'XI', 12: 'XII', 13: 'XIII', 14: 'I',
};
// Numérotation de tarot : figures XI–XIII, As = I (la carte reste la plus forte). Pas de lettre « V » pour le
// Valet, qui se lirait 5.

const RANK_NAME: Record<Rank, string> = {
  2: 'Deux', 3: 'Trois', 4: 'Quatre', 5: 'Cinq', 6: 'Six', 7: 'Sept', 8: 'Huit', 9: 'Neuf', 10: 'Dix',
  11: 'Valet', 12: 'Dame', 13: 'Roi', 14: 'As',
};

/** « de Coupes » / « d’Épées » : élision devant voyelle ou h muet. */
export function ofSuit(name: string): string {
  return /^[aeiouyéèêàâîôûh]/i.test(name) ? `d’${name}` : `de ${name}`;
}

const INK = '#111';
const CREAM = '#f4e9cf';
const SKY = '#9fd4e4';
const SEA = '#5fa9c9';
const STEEL = '#e6edf1';

const W = 120;
const H = 200;
const CX = 60;
const CY = 84;

function Emblem({ id, color, x, y, s }: { id: SuitId; color: string; x: number; y: number; s: number }) {
  const sw = 2.6 / s; // trait constant à l'écran, quelle que soit la taille du pip
  const common = { stroke: INK, strokeWidth: sw, strokeLinejoin: 'round' as const };
  let body: ReactNode;
  switch (id) {
    case 'coupes':
      body = (
        <>
          <path d="M-14,-16 H14 C14,-1 8,5 0,5 C-8,5 -14,-1 -14,-16 Z" fill={color} {...common} />
          <rect x={-2.5} y={5} width={5} height={8} fill={color} {...common} />
          <path d="M-10,19 H10 L6,13 H-6 Z" fill={color} {...common} />
        </>
      );
      break;
    case 'deniers':
      body = (
        <>
          <circle r={17} fill={color} {...common} />
          <circle r={11} fill="none" {...common} />
          <path d="M0,-8 L2.4,-2.4 L8,0 L2.4,2.4 L0,8 L-2.4,2.4 L-8,0 L-2.4,-2.4 Z" fill={INK} />
        </>
      );
      break;
    case 'epees':
      body = (
        <>
          <path d="M0,-21 L4.5,-14 V7 H-4.5 V-14 Z" fill={STEEL} {...common} />
          <rect x={-12} y={7} width={24} height={5} rx={1.5} fill={color} {...common} />
          <rect x={-2.5} y={12} width={5} height={6} fill={color} {...common} />
          <circle cy={20.5} r={3} fill={color} {...common} />
        </>
      );
      break;
    case 'batons':
      body = (
        <>
          <path d="M-5,-12 Q-12,-17 -12,-9 Q-8,-7 -5,-9 Z" fill="#7bc47f" {...common} />
          <path d="M5,0 Q12,-5 12,3 Q8,5 5,3 Z" fill="#7bc47f" {...common} />
          <rect x={-4.5} y={-20} width={9} height={40} rx={4.5} fill={color} {...common} />
        </>
      );
      break;
  }
  return <g transform={`translate(${x} ${y}) scale(${s})`}>{body}</g>;
}

/** Positions des pips (cartes numérotées), relatives au centre du ciel. */
function pips(n: number): [number, number][] {
  const c = (dx: number) => [[-dx, -30], [dx, -30], [-dx, 0], [dx, 0], [-dx, 30], [dx, 30]] as [number, number][];
  switch (n) {
    case 2: return [[0, -24], [0, 24]];
    case 3: return [[0, -26], [-22, 22], [22, 22]];
    case 4: return [[-20, -22], [20, -22], [-20, 22], [20, 22]];
    case 5: return [[-22, -26], [22, -26], [0, 0], [-22, 26], [22, 26]];
    case 6: return c(20);
    case 7: return [...c(24), [0, -15]];
    case 8: return [...c(24), [0, -15], [0, 15]];
    case 9: return [[-24, -36], [24, -36], [-24, -12], [24, -12], [-24, 12], [24, 12], [-24, 36], [24, 36], [0, 0]];
    default: return [[-24, -36], [24, -36], [-24, -12], [24, -12], [-24, 12], [24, 12], [-24, 36], [24, 36], [0, -24], [0, 24]];
  }
}

function pipScale(n: number): number {
  if (n <= 3) return 0.72;
  if (n <= 6) return 0.6;
  if (n <= 8) return 0.48;
  return 0.44;
}

function Crown({ rank }: { rank: Rank }) {
  const props = { fill: '#ffd23f', stroke: INK, strokeWidth: 2.4, strokeLinejoin: 'round' as const };
  if (rank === 13) return <path d="M44,58 V42 L52,50 L60,36 L68,50 L76,42 V58 Z" {...props} />;
  if (rank === 12) return <path d="M46,58 Q46,46 50,44 L53,50 L57,41 L60,48 L63,41 L67,50 L70,44 Q74,46 74,58 Z" {...props} />;
  return <path d="M60,38 L63.5,46 L72,46.5 L65.5,52 L67.5,60 L60,55.5 L52.5,60 L54.5,52 L48,46.5 L56.5,46 Z" {...props} />;
}

function Sun() {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    const r1 = 30;
    const r2 = i % 2 ? 40 : 46;
    return `M${CX + Math.cos(a) * r1},${CY + Math.sin(a) * r1} L${CX + Math.cos(a) * r2},${CY + Math.sin(a) * r2}`;
  }).join(' ');
  return (
    <>
      <path d={rays} stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      <circle cx={CX} cy={CY} r={30} fill="#ffe9a3" stroke={INK} strokeWidth={2.4} />
    </>
  );
}

function Art({ card, color }: { card: CardT; color: string }) {
  const { rank, suit } = card;
  if (rank === 14) {
    return (
      <>
        <Sun />
        <Emblem id={suit} color={color} x={CX} y={CY} s={1.15} />
      </>
    );
  }
  if (rank >= 11) {
    return (
      <>
        <Crown rank={rank} />
        <Emblem id={suit} color={color} x={CX} y={CY + 22} s={1.1} />
      </>
    );
  }
  const s = pipScale(rank);
  return <>{pips(rank).map(([dx, dy], i) => <Emblem key={i} id={suit} color={color} x={CX + dx} y={CY + dy} s={s} />)}</>;
}

function TarotFace({ card, suit }: { card: CardT; suit: SuitRule }) {
  const numeral = ROMAN[card.rank];
  const title = `${RANK_NAME[card.rank]} ${ofSuit(suit.name)}`.toUpperCase();
  const stroke = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const };
  return (
    <svg className="card-face" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
      {/* bordure à la couleur de la famille (réglable dans le labo) */}
      <rect x={0} y={0} width={W} height={H} rx={9} fill={suit.color} />
      {/* ciel */}
      <rect x={8} y={14} width={104} height={146} fill={SKY} {...stroke} />
      {/* lune */}
      <path d="M99,30 A9,9 0 1 0 105,44 A7,7 0 1 1 99,30 Z" fill="#fff6d6" stroke={INK} strokeWidth={1.8} />
      {/* mer + nuages */}
      <path d="M9.5,146 Q20,140 30,146 T50,146 T70,146 T90,146 T110.5,146 V158.5 H9.5 Z" fill={SEA} stroke={INK} strokeWidth={2} />
      <path d="M10,144 Q12,134 22,137 Q27,129 35,136 Q42,134 41,144 Z" fill="#fff" stroke={INK} strokeWidth={2} />
      <path d="M110,142 Q104,133 96,138 Q90,132 84,139 Q78,139 80,146 H110 Z" fill="#fff" stroke={INK} strokeWidth={2} />
      <Art card={card} color={suit.color} />
      {/* cartouche */}
      <rect x={32} y={4} width={56} height={28} rx={3} fill={CREAM} {...stroke} />
      <text
        x={CX}
        y={26}
        textAnchor="middle"
        className="card-numeral"
        {...(numeral.length > 3 ? { textLength: 48, lengthAdjust: 'spacingAndGlyphs' } : {})}
      >
        {numeral}
      </text>
      {/* bandeau */}
      <rect x={8} y={163} width={104} height={30} fill={CREAM} {...stroke} />
      <text
        x={CX}
        y={182.5}
        textAnchor="middle"
        className="card-title"
        {...(title.length * 8.4 > 94 ? { textLength: 94, lengthAdjust: 'spacingAndGlyphs' } : {})}
      >
        {title}
      </text>
    </svg>
  );
}

export function Card({ card, suit, selected, scoring, dimmed, order, onClick }: Props) {
  const label = RANK_LABEL[card.rank];
  const cls = ['card', selected && 'is-selected', scoring && 'is-scoring', dimmed && 'is-dimmed'].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      className={cls}
      onClick={onClick}
      disabled={!onClick}
      aria-pressed={selected}
      aria-label={`${label} ${ofSuit(suit.name)}`}
    >
      <TarotFace card={card} suit={suit} />
      {order !== undefined && <span className="card-order">{order}</span>}
    </button>
  );
}
