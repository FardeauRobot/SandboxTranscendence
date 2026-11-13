import { RANK_LABEL } from '../engine/deck';
import type { Card as CardT, SuitRule } from '../engine/types';

interface Props {
  card: CardT;
  suit: SuitRule;
  selected?: boolean;
  scoring?: boolean;
  dimmed?: boolean;
  order?: number;
  onClick?: () => void;
}

export function Card({ card, suit, selected, scoring, dimmed, order, onClick }: Props) {
  const label = RANK_LABEL[card.rank];
  const cls = ['card', selected && 'is-selected', scoring && 'is-scoring', dimmed && 'is-dimmed'].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      className={cls}
      style={{ ['--suit' as string]: suit.color }}
      onClick={onClick}
      disabled={!onClick}
      aria-pressed={selected}
      aria-label={`${label} ${/^[aeiouyéèêàâîôûh]/i.test(suit.name) ? 'd’' : 'de '}${suit.name}`}
    >
      <span className="card-corner">
        <span>{label}</span>
        <span>{suit.symbol}</span>
      </span>
      <span className="card-center">{suit.symbol}</span>
      <span className="card-corner card-corner--bottom">
        <span>{label}</span>
        <span>{suit.symbol}</span>
      </span>
      {order !== undefined && <span className="card-order">{order}</span>}
    </button>
  );
}
