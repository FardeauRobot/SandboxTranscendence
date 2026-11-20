import { useState } from 'react';
import { Crowd, SHOUTS } from '../Crowd';
import type { DanceId } from './dances';
import type { Player } from './state';
import { useArena } from './useArena';
import { webglAvailable } from './webgl';

interface Props {
  level: number;
  /** 0..1 : aura de chaque joueur. */
  auras: [number, number];
  /** Incrémenté à chaque main posée ; `pulseBy` dit qui vient de poser. */
  pulse: number;
  pulseBy: Player;
  /** La danse de la main posée (null : pas de danse). */
  dance: DanceId | null;
  /** Décalage du cadrage en px (pour recentrer quand un panneau couvre une partie de l'écran). */
  frameX?: number;
  frameY?: number;
}

/** Décor 3D de la battle. Sans WebGL, on retombe sur la foule 2D. */
export default function Arena3D({ level, auras, pulse, pulseBy, dance, frameX = 0, frameY = 0 }: Props) {
  const [ok] = useState(webglAvailable);
  const { wrap, canvas } = useArena(ok, { level, auras, pulse, pulseBy, dance, frameX, frameY });

  if (!ok) return <Crowd level={level} pulse={pulse} />;

  return (
    <div className="arena" ref={wrap} data-level={level}>
      <canvas ref={canvas} aria-label="Arène : les deux joueurs au milieu de la foule" role="img" />
      {level > 0 && (
        <div key={pulse} className="crowd-shout display" aria-live="polite">
          {SHOUTS[level]}
        </div>
      )}
    </div>
  );
}
