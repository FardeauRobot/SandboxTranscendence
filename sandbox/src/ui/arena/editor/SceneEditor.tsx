/**
 * Page de l'éditeur de scène (`?scene`) : l'arène plein écran, ses objets déplaçables à la souris,
 * et un panneau pour la saisie précise, les tests (poser, niveau, auras) et l'import / export.
 * Chaque changement est enregistré dans le navigateur ; le jeu le relit à son prochain chargement.
 */
import { useEffect, useRef, useState } from 'react';
import {
  clearLayout, cloneLayout, DEFAULT_LAYOUT, loadLayout, mergeLayout, saveLayout, type SceneLayout,
} from '../layout';
import { DANCE_IDS, DANCE_LABEL, type DanceId } from '../dances';
import { createArena, type Arena } from '../scene';
import type { Player } from '../state';
import { webglAvailable } from '../webgl';
import { createSceneEditor, positionOf, type EditMode, type HandleInfo, type SceneEditor, type ViewMode } from './editor';

const AXES = ['X', 'Y', 'Z'] as const;

export default function SceneEditorPage() {
  const [ok] = useState(webglAvailable);
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const arenaRef = useRef<Arena | null>(null);
  const editorRef = useRef<SceneEditor | null>(null);

  const [layout, setLayout] = useState<SceneLayout>(loadLayout);
  // la disposition courante, lue au montage sans faire du montage une dépendance de la disposition
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const [handles, setHandles] = useState<readonly HandleInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<EditMode>('translate');
  const [view, setView] = useState<ViewMode>('free');
  const [snap, setSnap] = useState(false);
  const [level, setLevel] = useState(0);
  const [dance, setDance] = useState<DanceId>('quinte_flush_royale');
  const [auras, setAuras] = useState<[number, number]>([0.3, 0.3]);
  const [paste, setPaste] = useState('');
  const [note, setNote] = useState('');

  // ---- montage : l'arène, puis l'éditeur greffé dessus ; libérés dans l'ordre inverse
  useEffect(() => {
    if (!ok || !canvas.current || !wrap.current) return;
    const box = wrap.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const arena = createArena(canvas.current, reduced, layoutRef.current);
    const editor = createSceneEditor(arena.rig, canvas.current, {
      onChange(l) {
        setLayout(l);
        saveLayout(l);
      },
      onSelect: setSelected,
    });
    const fit = () => {
      arena.resize(box.clientWidth, box.clientHeight);
      editor.resize(box.clientWidth, box.clientHeight);
    };
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    fit();
    arenaRef.current = arena;
    editorRef.current = editor;
    setHandles(editor.handles);
    return () => {
      ro.disconnect();
      editor.dispose();
      arena.dispose();
      arenaRef.current = null;
      editorRef.current = null;
    };
  }, [ok]);

  // ---- l'état du panneau répercuté sur l'éditeur et l'arène
  useEffect(() => { editorRef.current?.setMode(mode); }, [mode]);
  useEffect(() => { editorRef.current?.setSnap(snap); }, [snap]);
  useEffect(() => { editorRef.current?.setView(view); }, [view]);
  useEffect(() => { arenaRef.current?.setLevel(level); }, [level]);
  const [a0, a1] = auras;
  useEffect(() => { arenaRef.current?.setAura(0, a0); arenaRef.current?.setAura(1, a1); }, [a0, a1]);

  // ---- raccourcis : W déplacer, E tourner, V changer de vue, Échap désélectionner
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'w') setMode('translate');
      else if (k === 'e') setMode('rotate');
      else if (k === 'v') setView((v) => (v === 'free' ? 'game' : 'free'));
      else if (e.key === 'Escape') editorRef.current?.select(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /** Applique une disposition venue du panneau (saisie, import, réinitialisation). */
  const apply = (l: SceneLayout) => {
    setLayout(l);
    saveLayout(l);
    editorRef.current?.setLayout(l);
  };

  const setCoord = (axis: number, v: number) => {
    if (!selected) return;
    const l = cloneLayout(layout);
    positionOf(l, selected)[axis] = v;
    apply(l);
  };

  const setRotation = (deg: number) => {
    if (selected !== 'fighter0' && selected !== 'fighter1') return;
    const l = cloneLayout(layout);
    l.fighters[selected === 'fighter0' ? 0 : 1].rotY = (deg * Math.PI) / 180;
    apply(l);
  };

  const reset = () => {
    const l = cloneLayout(DEFAULT_LAYOUT);
    setLayout(l);
    editorRef.current?.setLayout(l);
    clearLayout();
    setNote('Disposition d’origine rétablie.');
  };

  const copyJson = async () => {
    const text = JSON.stringify(layout, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setNote('JSON copié.');
    } catch {
      setPaste(text);
      setNote('Presse-papiers indisponible : le JSON est dans le champ ci-dessous.');
    }
  };

  const importJson = () => {
    try {
      // un JSON partiel (la caméra seule, par ex.) ne touche qu'à ce qu'il contient
      apply(mergeLayout(JSON.parse(paste), layout));
      setNote('Disposition importée.');
    } catch {
      setNote('JSON illisible : rien n’a changé.');
    }
  };

  const current = handles.find((h) => h.id === selected) ?? null;
  const pos = selected ? positionOf(layout, selected) : null;
  const fighterIndex = selected === 'fighter0' ? 0 : selected === 'fighter1' ? 1 : null;

  return (
    <div className="scene-edit">
      <nav className="topbar">
        <span className="display brand">AURA</span>
        <span className="display tag">Éditeur de scène</span>
        <button type="button" className="ghost" onClick={() => { window.location.href = window.location.pathname; }}>
          Retour au jeu
        </button>
      </nav>

      <div className="scene-viewport" ref={wrap}>
        {ok ? (
          <canvas ref={canvas} aria-label="Arène en édition : cliquer un objet pour le déplacer" />
        ) : (
          <p className="scene-nogl">WebGL n’est pas disponible dans ce navigateur : l’éditeur de scène en a besoin.</p>
        )}
      </div>

      <aside className="scene-panel" aria-label="Panneau de l’éditeur de scène">
        <p className="small muted">
          Clic : sélectionner · glisser : tourner la vue · clic droit : la décaler · molette : zoom ·
          W / E : déplacer / tourner · V : vue joueur · Échap : désélectionner
        </p>

        <section>
          <h3 className="display">Objets</h3>
          <div className="scene-objects">
            {handles.map((h) => (
              <button
                key={h.id}
                type="button"
                className={`ghost${h.id === selected ? ' is-on' : ''}`}
                aria-pressed={h.id === selected}
                disabled={view === 'game' && h.id.startsWith('cam')}
                title={view === 'game' && h.id.startsWith('cam') ? 'Repasser en vue libre pour déplacer la caméra' : undefined}
                onClick={() => editorRef.current?.select(h.id === selected ? null : h.id)}
              >
                {h.label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="display">{current ? current.label : 'Aucune sélection'}</h3>
          {pos ? (
            <div className="scene-coords">
              {AXES.map((a, i) => (
                <NumField key={a} label={a} value={pos[i]} step={0.1} onCommit={(v) => setCoord(i, v)} />
              ))}
              {fighterIndex !== null && (
                <NumField
                  label="Rot. °"
                  value={Math.round((layout.fighters[fighterIndex].rotY * 180) / Math.PI)}
                  step={5}
                  onCommit={setRotation}
                />
              )}
            </div>
          ) : (
            <p className="small muted">Clique un combattant, une lumière (sphère), sa cible (losange) ou la caméra (jaune).</p>
          )}
        </section>

        <section>
          <h3 className="display">Outils</h3>
          <div className="scene-row">
            <button type="button" className={`ghost${mode === 'translate' ? ' is-on' : ''}`} aria-pressed={mode === 'translate'} onClick={() => setMode('translate')}>
              Déplacer
            </button>
            <button
              type="button"
              className={`ghost${mode === 'rotate' ? ' is-on' : ''}`}
              aria-pressed={mode === 'rotate'}
              onClick={() => setMode('rotate')}
              title="Seuls les combattants tournent"
            >
              Tourner
            </button>
          </div>
          <div className="scene-row">
            <button type="button" className={`ghost${view === 'free' ? ' is-on' : ''}`} aria-pressed={view === 'free'} onClick={() => setView('free')}>
              Vue libre
            </button>
            <button type="button" className={`ghost${view === 'game' ? ' is-on' : ''}`} aria-pressed={view === 'game'} onClick={() => setView('game')}>
              Vue joueur
            </button>
          </div>
          <label className="scene-check">
            <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
            Aimanter (0,1 · 15°)
          </label>
        </section>

        <section>
          <h3 className="display">Tester</h3>
          <label className="scene-slider">
            <span>Danse</span>
            <select value={dance} onChange={(e) => setDance(e.target.value as DanceId)}>
              {DANCE_IDS.map((id) => <option key={id} value={id}>{DANCE_LABEL[id]}</option>)}
            </select>
          </label>
          <div className="scene-row">
            {([0, 1] as Player[]).map((p) => (
              <button key={p} type="button" className="ghost" onClick={() => arenaRef.current?.burst(p, dance)}>
                Pose J{p + 1}
              </button>
            ))}
          </div>
          <label className="scene-slider">
            <span>Niveau {level}</span>
            <input type="range" min={0} max={4} step={1} value={level} onChange={(e) => setLevel(Number(e.target.value))} />
          </label>
          {([0, 1] as Player[]).map((p) => (
            <label key={p} className="scene-slider">
              <span>Aura J{p + 1}</span>
              <input
                type="range" min={0} max={1} step={0.05} value={auras[p]}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setAuras((a) => (p === 0 ? [v, a[1]] : [a[0], v]));
                }}
              />
            </label>
          ))}
        </section>

        <section>
          <h3 className="display">Sauvegarde</h3>
          <p className="small muted">
            Enregistré dans ce navigateur à chaque changement ; le jeu le reprend au prochain chargement.
            Pour en faire la valeur par défaut, colle le JSON dans <code>DEFAULT_LAYOUT</code> (<code>layout.ts</code>).
          </p>
          <div className="scene-row">
            <button type="button" className="ghost" onClick={copyJson}>Copier le JSON</button>
            <button type="button" className="ghost" onClick={reset}>Réinitialiser</button>
          </div>
          <textarea
            className="scene-paste"
            rows={4}
            placeholder="Colle ici un JSON de disposition…"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
          <button type="button" className="ghost" onClick={importJson} disabled={!paste.trim()}>Importer</button>
          {note && <p className="small" role="status">{note}</p>}
        </section>
      </aside>
    </div>
  );
}

/**
 * Champ numérique qui garde ce qu'on tape (« - », « 1. ») tant qu'il a le focus,
 * et ne transmet que des nombres finis ; hors focus, il suit la valeur (déplacements à la souris).
 */
function NumField({ label, value, step, onCommit }: { label: string; value: number; step: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setText(String(value)); }, [value, focused]);
  return (
    <label className="scene-num">
      <span>{label}</span>
      <input
        type="number"
        step={step}
        value={text}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          setText(e.target.value);
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onCommit(v);
        }}
      />
    </label>
  );
}
