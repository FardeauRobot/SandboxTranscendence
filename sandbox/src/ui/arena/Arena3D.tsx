import { useEffect, useRef, useState } from 'react';
import { Crowd, SHOUTS } from '../Crowd';
import { createArena, type Arena } from './scene';

interface Props {
  level: number;
  /** 0..1 : aura de chaque joueur. */
  auras: [number, number];
  /** Incrémenté à chaque main posée ; `pulseBy` dit qui vient de poser. */
  pulse: number;
  pulseBy: 0 | 1;
  /** Décalage du cadrage en px (pour recentrer quand un panneau couvre une partie de l'écran). */
  frameX?: number;
  frameY?: number;
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Décor 3D de la battle. Sans WebGL, on retombe sur la foule 2D. */
export default function Arena3D({ level, auras, pulse, pulseBy, frameX = 0, frameY = 0 }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const arena = useRef<Arena | null>(null);
  const [ok] = useState(webglAvailable);
  const frameRef = useRef({ x: frameX, y: frameY });
  frameRef.current = { x: frameX, y: frameY };

  useEffect(() => {
    if (!ok || !canvas.current || !wrap.current) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const a = createArena(canvas.current, reduced);
    arena.current = a;
    const el = wrap.current;
    const ro = new ResizeObserver(() => a.resize(el.clientWidth, el.clientHeight));
    ro.observe(el);
    a.resize(el.clientWidth, el.clientHeight);
    a.setFrame(frameRef.current.x, frameRef.current.y);
    return () => {
      ro.disconnect();
      a.dispose();
      arena.current = null;
    };
  }, [ok]);

  useEffect(() => { arena.current?.setLevel(level); }, [level]);
  const [a0, a1] = auras;
  useEffect(() => { arena.current?.setAura(0, a0); arena.current?.setAura(1, a1); }, [a0, a1]);
  useEffect(() => { if (pulse > 0) arena.current?.burst(pulseBy); }, [pulse]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { arena.current?.setFrame(frameX, frameY); }, [frameX, frameY]);

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
