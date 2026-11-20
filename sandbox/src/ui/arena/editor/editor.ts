/**
 * Éditeur de scène, côté three.js : caméra libre (OrbitControls), sélection au clic, gizmo de
 * déplacement / rotation (TransformControls), repères des lumières et de la caméra de jeu.
 *
 * Il se greffe sur une arène existante (`arena.rig`) sans toucher à sa boucle : il fournit la caméra de
 * rendu (`rig.view`) et met ses repères à jour dans `rig.beforeRender`. `dispose()` retire tout ce
 * qu'il a ajouté ; l'arène peut ensuite être libérée normalement.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { BLUE, RED, YELLOW } from '../config';
import { applyLayout, readLayout, type LayoutTargets, type SceneLayout, type SpotName, type Vec3 } from '../layout';
import type { ArenaRig } from '../scene';

/** Ce que l'interface sait d'un objet déplaçable. */
export interface HandleInfo {
  id: string;
  label: string;
  /** La rotation (autour de la verticale) a un sens pour cet objet. */
  rotatable: boolean;
}

interface Handle extends HandleInfo {
  /** L'objet que le gizmo déplace. */
  object: THREE.Object3D;
  /** Ce sur quoi on clique pour le sélectionner. */
  pickable: THREE.Object3D;
  /** Le gizmo de déplacement garde la hauteur (combattants posés sur le ring). */
  flat?: boolean;
  /** Repère de la caméra de jeu : hors d'atteinte en vue joueur (on ne déplace pas la caméra par laquelle on regarde). */
  camera?: boolean;
  /** Recopie la position de `object` là où la scène la lit (repères de la caméra de jeu). */
  commit?: () => void;
  /** Remet `object` à la position lue dans la scène (après une nouvelle disposition). */
  sync?: () => void;
}

export type EditMode = 'translate' | 'rotate';
export type ViewMode = 'free' | 'game';

export interface SceneEditor {
  readonly handles: readonly HandleInfo[];
  select(id: string | null): void;
  setMode(m: EditMode): void;
  /** Aimante les déplacements (0,1) et les rotations (15°). */
  setSnap(on: boolean): void;
  /**
   * Vue libre (orbite à la souris, repères visibles) ou vue de la caméra de jeu : repères cachés,
   * seuls les combattants restent cliquables, la caméra de jeu ne se sélectionne plus.
   */
  setView(v: ViewMode): void;
  /** Applique une disposition (saisie au clavier, import, réinitialisation). */
  setLayout(l: SceneLayout): void;
  resize(w: number, h: number): void;
  dispose(): void;
}

export interface EditorEvents {
  /** Pendant un déplacement à la souris : la disposition relue depuis la scène. */
  onChange(l: SceneLayout): void;
  onSelect(id: string | null): void;
}

/** Au-delà de ce déplacement du pointeur (px), un clic est un glissé de la vue, pas une sélection. */
const CLICK_SLOP = 4;

const SPOTS: readonly { name: SpotName; label: string; color: number }[] = [
  { name: 'spotBlue', label: 'Projecteur bleu', color: BLUE },
  { name: 'spotRed', label: 'Projecteur rouge', color: RED },
  { name: 'spotTop', label: 'Douche centrale', color: 0xffffff },
  { name: 'standWash', label: 'Éclairage tribunes', color: 0xfff1d0 },
];

export function createSceneEditor(rig: ArenaRig, dom: HTMLElement, events: EditorEvents): SceneEditor {
  const { scene } = rig;
  const targets: LayoutTargets = { fighters: rig.fighters, lights: rig.lights, camera: rig.camera };

  /** Tout ce que l'éditeur accroche à la scène, à retirer à la fin. */
  const added: THREE.Object3D[] = [];
  const attach = <T extends THREE.Object3D>(parent: THREE.Object3D, obj: T): T => {
    parent.add(obj);
    added.push(obj);
    return obj;
  };

  // ---- caméra libre
  const free = new THREE.PerspectiveCamera(50, 1, 0.1, 300);
  free.position.set(13, 11, 17);
  const orbit = new OrbitControls(free, dom);
  orbit.target.set(0, 1.2, 0);
  orbit.enableDamping = true;
  orbit.update();

  // ---- objets déplaçables et leurs repères
  const handles: Handle[] = [];

  rig.fighters.forEach((f, i) => {
    // le Y Bot skinné se prête mal au raycast : une boîte invisible autour du combattant
    const geo = new THREE.CylinderGeometry(0.8, 0.8, 2.6, 12);
    geo.translate(0, 1.3, 0);
    const hitbox = attach(f.root, new THREE.Mesh(geo, new THREE.MeshBasicMaterial()));
    hitbox.visible = false;
    handles.push({
      id: `fighter${i}`, label: i === 0 ? 'J1 · bleu' : 'J2 · rouge', rotatable: true, flat: true,
      object: f.root, pickable: hitbox,
    });
  });

  const cameraHandle = (id: string, label: string, vec: THREE.Vector3, geo: THREE.BufferGeometry) => {
    const proxy = attach(scene, new THREE.Object3D());
    proxy.position.copy(vec);
    const m = attach(proxy, marker(geo, YELLOW));
    handles.push({
      id, label, rotatable: false, camera: true, object: proxy, pickable: m,
      commit: () => vec.copy(proxy.position),
      sync: () => proxy.position.copy(vec),
    });
  };
  cameraHandle('camBase', 'Caméra', rig.camera.base, new THREE.BoxGeometry(0.6, 0.4, 0.4));
  cameraHandle('camLook', 'Visée de la caméra', rig.camera.look, new THREE.OctahedronGeometry(0.22));

  for (const { name, label, color } of SPOTS) {
    const spot = rig.lights[name];
    handles.push({
      id: name, label, rotatable: false,
      object: spot, pickable: attach(spot, marker(new THREE.SphereGeometry(0.3, 16, 12), color)),
    });
    handles.push({
      id: `${name}.target`, label: `${label} → cible`, rotatable: false,
      object: spot.target, pickable: attach(spot.target, marker(new THREE.OctahedronGeometry(0.2), color)),
    });
  }
  handles.push({
    id: 'strobe', label: 'Stroboscope', rotatable: false,
    object: rig.lights.strobe, pickable: attach(rig.lights.strobe, marker(new THREE.SphereGeometry(0.25, 16, 12), 0xffffff)),
  });

  // ---- aides visuelles (vue libre seulement) : cônes des projecteurs, ligne de visée
  const helpers = attach(scene, new THREE.Group());
  const spotHelpers = SPOTS.map(({ name, color }) => new THREE.SpotLightHelper(rig.lights[name], color));
  const strobeHelper = new THREE.PointLightHelper(rig.lights.strobe, 0.4, 0xffffff);
  helpers.add(...spotHelpers, strobeHelper);
  const sight = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
    new THREE.LineDashedMaterial({ color: YELLOW, dashSize: 0.3, gapSize: 0.2 }),
  );
  helpers.add(sight);

  // ---- gizmo
  const gizmo = new TransformControls(free, dom);
  const gizmoHelper = gizmo.getHelper();
  scene.add(gizmoHelper);
  let selected: Handle | null = null;
  let mode: EditMode = 'translate';
  let view: ViewMode = 'free';
  /** Le geste en cours a commencé sur le gizmo : son relâchement ne sélectionne rien. */
  let onGizmo = false;

  gizmo.addEventListener('dragging-changed', (e) => {
    orbit.enabled = !e.value && view === 'free';
  });
  gizmo.addEventListener('objectChange', () => {
    selected?.commit?.();
    events.onChange(readLayout(targets));
  });

  function configureGizmo() {
    const rotating = mode === 'rotate' && !!selected?.rotatable;
    gizmo.setMode(rotating ? 'rotate' : 'translate');
    gizmo.showX = !rotating;
    gizmo.showZ = !rotating;
    gizmo.showY = rotating || !selected?.flat;
  }

  function select(id: string | null) {
    selected = handles.find((h) => h.id === id) ?? null;
    if (selected?.camera && view === 'game') selected = null;
    if (selected) gizmo.attach(selected.object);
    else gizmo.detach();
    configureGizmo();
    events.onSelect(selected?.id ?? null);
  }

  // ---- sélection au clic
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickables = handles.map((h) => h.pickable);
  /** Les repères visibles (tout sauf les boîtes invisibles des combattants), cachés en vue joueur. */
  const markers = handles.filter((h) => !h.flat).map((h) => h.pickable);
  const fighterBoxes = handles.filter((h) => h.flat).map((h) => h.pickable);
  let down: { x: number; y: number } | null = null;

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    down = { x: e.clientX, y: e.clientY };
    onGizmo = gizmo.axis !== null || gizmo.dragging;
  };
  const onPointerUp = (e: PointerEvent) => {
    if (e.button !== 0 || !down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > CLICK_SLOP;
    down = null;
    if (moved || onGizmo) return;
    const r = dom.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, view === 'free' ? free : rig.camera.camera);
    const hit = ray.intersectObjects(view === 'free' ? pickables : fighterBoxes, false)[0];
    select(hit ? handles.find((h) => h.pickable === hit.object)!.id : null);
  };
  dom.addEventListener('pointerdown', onPointerDown);
  dom.addEventListener('pointerup', onPointerUp);

  // ---- à chaque frame
  const sightPos = sight.geometry.getAttribute('position') as THREE.BufferAttribute;
  rig.beforeRender = () => {
    if (view === 'free') orbit.update();
    for (const h of spotHelpers) h.update();
    strobeHelper.update();
    sightPos.setXYZ(0, rig.camera.base.x, rig.camera.base.y, rig.camera.base.z);
    sightPos.setXYZ(1, rig.camera.look.x, rig.camera.look.y, rig.camera.look.z);
    sightPos.needsUpdate = true;
    sight.computeLineDistances();
  };
  rig.view = free;

  return {
    handles: handles.map(({ id, label, rotatable }) => ({ id, label, rotatable })),
    select,
    setMode(m) {
      mode = m;
      configureGizmo();
    },
    setSnap(on) {
      gizmo.setTranslationSnap(on ? 0.1 : null);
      gizmo.setRotationSnap(on ? THREE.MathUtils.degToRad(15) : null);
    },
    setView(v) {
      view = v;
      rig.view = v === 'free' ? free : null;
      orbit.enabled = v === 'free';
      gizmo.camera = v === 'free' ? free : rig.camera.camera;
      helpers.visible = v === 'free';
      for (const m of markers) m.visible = v === 'free';
      if (v === 'game' && selected?.camera) select(null);
    },
    setLayout(l) {
      applyLayout(targets, l);
      for (const h of handles) h.sync?.();
    },
    resize(w, h) {
      free.aspect = w / Math.max(1, h);
      free.updateProjectionMatrix();
    },
    dispose() {
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointerup', onPointerUp);
      rig.beforeRender = null;
      rig.view = null;
      gizmo.detach();
      scene.remove(gizmoHelper);
      gizmo.dispose();
      orbit.dispose();
      for (const h of spotHelpers) h.dispose();
      strobeHelper.dispose();
      for (const obj of added) {
        obj.removeFromParent();
        obj.traverse((o) => {
          const mesh = o as THREE.Mesh;
          mesh.geometry?.dispose();
          (mesh.material as THREE.Material | undefined)?.dispose();
        });
      }
    },
  };
}

/** La position de l'objet `id` dans la disposition `l` (le tableau lui-même, modifiable). */
export function positionOf(l: SceneLayout, id: string): Vec3 {
  if (id === 'fighter0' || id === 'fighter1') return l.fighters[id === 'fighter0' ? 0 : 1].pos;
  if (id === 'camBase') return l.camera.base;
  if (id === 'camLook') return l.camera.look;
  if (id === 'strobe') return l.lights.strobe.pos;
  const [name, part] = id.split('.') as [SpotName, string | undefined];
  return part === 'target' ? l.lights[name].target : l.lights[name].pos;
}

/** Repère cliquable, toujours visible (même derrière les gradins). */
function marker(geo: THREE.BufferGeometry, color: number): THREE.Mesh {
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.9 }));
  m.renderOrder = 10;
  return m;
}
