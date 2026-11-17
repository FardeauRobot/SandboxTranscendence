"""Branche le Y Bot dansant dans src/ui/arena/scene.ts (modifs ciblées, le reste du fichier est intact)."""
import sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()

def rep(old, new, count=1):
    global s
    assert s.count(old) == count, (old[:60], s.count(old))
    s = s.replace(old, new)

rep(""" * Apparences par défaut : silhouettes low-poly (capsule + sphère). Pour mettre de vrais modèles plus tard,
 * il suffit de remplacer `makeFighter()` et la géométrie des `InstancedMesh` de la foule.
 *
 * Pilotage depuis l'extérieur : `setLevel(0..4)`, `setAura(joueur, 0..1)`, `burst(joueur)` (à chaque main posée).
 */
import * as THREE from 'three';
""", """ * Combattants : le Y Bot de Mixamo (public/models/ybot_dances.glb), chargé en asynchrone. En attendant
 * (ou si le chargement échoue), on garde les silhouettes low-poly (capsule + sphère).
 * Le GLB contient trois clips sur le même squelette : `idle` (repos, en boucle), `mocap` (Chicken Dance
 * capturée) et `keyframes` (la même, réécrite en code). À chaque main posée, le joueur danse DANCE_REPEAT fois.
 *
 * Pilotage depuis l'extérieur : `setLevel(0..4)`, `setAura(joueur, 0..1)`, `burst(joueur)` (à chaque main posée).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
""")

rep("""const INK = 0x111111;
""", """const INK = 0x111111;

const MODEL_URL = `${import.meta.env.BASE_URL}models/ybot_dances.glb`;
/** Clip joué quand une main est posée : 'mocap' ou 'keyframes'. */
const DANCE_CLIP = 'mocap';
const DANCE_REPEAT = 2;
/** Le Y Bot mesure 1,80 m ; les silhouettes font ~2,4 unités. */
const MODEL_SCALE = 1.3;
/** Durée des fondus entre repos et danse (s). */
const FADE = 0.25;
""")

rep("""  particles: THREE.Points;
  light: THREE.PointLight;
}
""", """  particles: THREE.Points;
  light: THREE.PointLight;
  /** Présent une fois le Y Bot chargé ; les silhouettes sont alors cachées. */
  model?: FighterModel;
}

interface FighterModel {
  mixer: THREE.AnimationMixer;
  idle: THREE.AnimationAction;
  dance: THREE.AnimationAction;
}

/** Remplace la silhouette d'un combattant par le Y Bot, teinté à sa couleur, au repos. */
function attachModel(f: Fighter, gltf: { scene: THREE.Object3D; animations: THREE.AnimationClip[] }, color: number) {
  const model = SkeletonUtils.clone(gltf.scene);
  model.scale.setScalar(MODEL_SCALE);
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    // Beta_Surface = la peau, Beta_Joints = les articulations
    mesh.material = mesh.name.includes('Joints') ? std(INK) : std(color);
    mesh.castShadow = true;
    mesh.frustumCulled = false; // la boîte englobante d'un mesh skinné ne suit pas l'animation
  });
  f.body.children.forEach((c) => { c.visible = false; });
  f.body.add(model);

  const mixer = new THREE.AnimationMixer(model);
  const clip = (name: string) => {
    const c = THREE.AnimationClip.findByName(gltf.animations, name);
    if (!c) throw new Error(`clip « ${name} » absent de ${MODEL_URL}`);
    return c;
  };
  const idle = mixer.clipAction(clip('idle'));
  const dance = mixer.clipAction(clip(DANCE_CLIP));
  dance.setLoop(THREE.LoopRepeat, DANCE_REPEAT);
  dance.clampWhenFinished = true;
  idle.play();
  mixer.addEventListener('finished', (e) => {
    if (e.action !== dance) return;
    idle.reset().fadeIn(FADE * 2).play();
    dance.fadeOut(FADE * 2);
  });
  f.model = { mixer, idle, dance };
}

/** Lance la danse (ou la relance si le joueur pose à nouveau pendant qu'il danse). */
function startDance(f: Fighter) {
  const m = f.model;
  if (!m) return false;
  m.dance.reset().setEffectiveWeight(1).fadeIn(FADE).play();
  m.idle.fadeOut(FADE);
  return true;
}
""")

rep("""  const p2 = makeFighter(RED, RED, 1.9);
  scene.add(p1.root, p2.root);
""", """  const p2 = makeFighter(RED, RED, 1.9);
  scene.add(p1.root, p2.root);
  let disposed = false;
  new GLTFLoader().load(
    MODEL_URL,
    (gltf) => {
      if (disposed) return;
      attachModel(p1, gltf, BLUE);
      attachModel(p2, gltf, RED);
      // décale le repos du J2 pour que les deux ne respirent pas en miroir
      p2.model?.mixer.update(0.9);
    },
    undefined,
    (err) => console.warn('[arena] Y Bot non chargé, on garde les silhouettes :', err),
  );
""")

rep("""    const breathe = Math.sin(t * 2) * 0.03;
    f.body.position.y = breathe + jump;
""", """    if (f.model) {
      // Le Y Bot a son propre repos et sa danse : pas de saut ni de bras procéduraux.
      f.body.position.y = 0;
    } else {
      const breathe = Math.sin(t * 2) * 0.03;
      f.body.position.y = breathe + jump;
    }
""")

rep("""    f.armL.rotation.z = -lift + Math.sin(t * 3) * 0.05;
    f.armR.rotation.z = lift - Math.sin(t * 3) * 0.05;
""", """    if (!f.model) {
      f.armL.rotation.z = -lift + Math.sin(t * 3) * 0.05;
      f.armR.rotation.z = lift - Math.sin(t * 3) * 0.05;
    }
""")

rep("""    const since = t - burstT;
""", """    const since = t - burstT;
    p1.model?.mixer.update(dt);
    p2.model?.mixer.update(dt);
""")

rep("""    burst(p) { burstP = p; burstT = clock.elapsedTime; },
""", """    burst(p) {
      burstP = p;
      burstT = clock.elapsedTime;
      startDance(p === 0 ? p1 : p2);
    },
""")

rep("""    dispose() {
      cancelAnimationFrame(raf);
""", """    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      for (const f of [p1, p2]) f.model?.mixer.stopAllAction();
""")

open(p, 'w', encoding='utf-8').write(s)
print('ok')
