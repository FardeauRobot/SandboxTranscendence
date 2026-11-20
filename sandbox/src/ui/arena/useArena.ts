/** Hook React qui crée l'arène three.js sur un canvas et lui transmet les props d'`Arena3D`. */
import { useEffect, useRef, type RefObject } from 'react';
import type { DanceId } from './dances';
import { loadLayout } from './layout';
import { createArena, type Arena } from './scene';
import type { Player } from './state';

/** Ce que l'arène reçoit de React. */
export interface ArenaInputs {
  level: number;
  /** 0..1 : aura de chaque joueur. */
  auras: [number, number];
  /** Incrémenté à chaque main posée ; `pulseBy` dit qui vient de poser. */
  pulse: number;
  pulseBy: Player;
  /** La danse de la main qui vient d'être posée (null : aucune main reconnue). */
  dance: DanceId | null;
  /** Décalage du cadrage en px. */
  frameX: number;
  frameY: number;
}

export interface ArenaRefs {
  /** Conteneur dont la taille fixe celle du rendu. */
  wrap: RefObject<HTMLDivElement>;
  canvas: RefObject<HTMLCanvasElement>;
}

/**
 * Monte l'arène si `enabled` (WebGL disponible), la garde à la taille de `wrap`, la libère au démontage,
 * et lui répercute chaque prop quand elle change (une main posée = `pulse` qui augmente).
 */
export function useArena(enabled: boolean, { level, auras, pulse, pulseBy, dance, frameX, frameY }: ArenaInputs): ArenaRefs {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const arena = useRef<Arena | null>(null);
  // Le cadrage courant, lu au montage sans faire de l'effet de montage une dépendance du cadrage.
  const frameRef = useRef({ x: frameX, y: frameY });
  frameRef.current = { x: frameX, y: frameY };

  useEffect(() => {
    if (!enabled || !canvas.current || !wrap.current) return;
    const mounted = mountArena(canvas.current, wrap.current, frameRef.current);
    arena.current = mounted.arena;
    return () => {
      mounted.unmount();
      arena.current = null;
    };
  }, [enabled]);

  useEffect(() => { arena.current?.setLevel(level); }, [level]);
  const [a0, a1] = auras;
  useEffect(() => { arena.current?.setAura(0, a0); arena.current?.setAura(1, a1); }, [a0, a1]);
  useEffect(() => { if (pulse > 0) arena.current?.burst(pulseBy, dance); }, [pulse]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { arena.current?.setFrame(frameX, frameY); }, [frameX, frameY]);

  return { wrap, canvas };
}

/** Crée l'arène sur `canvas` et la redimensionne avec `wrap` ; `unmount` coupe l'observateur puis libère tout. */
function mountArena(
  canvas: HTMLCanvasElement,
  wrap: HTMLDivElement,
  frame: { x: number; y: number },
): { arena: Arena; unmount: () => void } {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // la disposition enregistrée par l'éditeur de scène, sinon celle par défaut
  const arena = createArena(canvas, reduced, loadLayout());
  const ro = new ResizeObserver(() => arena.resize(wrap.clientWidth, wrap.clientHeight));
  ro.observe(wrap);
  arena.resize(wrap.clientWidth, wrap.clientHeight);
  arena.setFrame(frame.x, frame.y);
  return {
    arena,
    unmount() {
      ro.disconnect();
      arena.dispose();
    },
  };
}
