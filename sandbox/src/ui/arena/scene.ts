/**
 * Arène 3D de la battle d'aura, en three.js pur (pas de React ici).
 *
 * Combattants : le Y Bot de Mixamo (public/models/ybot_dances.glb), chargé en asynchrone. En attendant
 * (ou si le chargement échoue), on garde les silhouettes low-poly (capsule + sphère).
 * Le GLB contient trois clips sur le même squelette : `idle` (repos, en boucle), `mocap` (Chicken Dance
 * capturée) et `keyframes` (la même, réécrite en code). À chaque main posée, le joueur danse DANCE_REPEAT fois.
 *
 * Pilotage depuis l'extérieur : `setLevel(0..4)`, `setAura(joueur, 0..1)`, `burst(joueur)` (à chaque main posée).
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { makeRng } from '../../engine/deck';

const BLUE = 0x1b8fd6;
const RED = 0xe2264d;
const YELLOW = 0xffd23f;
const INK = 0x111111;

const MODEL_URL = `${import.meta.env.BASE_URL}models/ybot_dances.glb`;
/** Clip joué quand une main est posée : 'mocap' ou 'keyframes'. */
const DANCE_CLIP = 'mocap';
const DANCE_REPEAT = 2;
/** Le Y Bot mesure 1,80 m ; les silhouettes font ~2,4 unités. */
const MODEL_SCALE = 1.3;
/** Durée des fondus entre repos et danse (s). */
const FADE = 0.25;

/** Paramètres de la foule par niveau : amplitude du saut, vitesse, part de bras levés. */
const CROWD = [
  { amp: 0.03, speed: 1.2, raised: 0 },
  { amp: 0.08, speed: 2.2, raised: 0.1 },
  { amp: 0.18, speed: 3.2, raised: 0.35 },
  { amp: 0.32, speed: 4.4, raised: 0.7 },
  { amp: 0.5, speed: 5.6, raised: 1 },
];

/** Vide dans les tribunes, face à la caméra, pour voir les combattants. */
const GAP = 1.05;

interface Spectator {
  x: number;
  z: number;
  y: number;
  rot: number;
  phase: number;
  speed: number;
  hype: number;
}

interface Fighter {
  root: THREE.Group;
  body: THREE.Group;
  armL: THREE.Mesh;
  armR: THREE.Mesh;
  aura: THREE.Group;
  shells: THREE.Mesh[];
  particles: THREE.Points;
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

export interface Arena {
  setLevel(level: number): void;
  /** Aura d'un combattant (0 = J1 bleu, 1 = J2 rouge), 0..1. */
  setAura(player: 0 | 1, v: number): void;
  /** Un combattant vient de poser : il saute, la caméra plonge vers lui. */
  burst(player: 0 | 1): void;
  resize(w: number, h: number): void;
  /** Décale le cadrage (px CSS) : x > 0 pousse la scène vers la gauche, y > 0 vers le haut. */
  setFrame(x: number, y: number): void;
  dispose(): void;
}

/** Dégradé vertical (transparent en haut et en bas) pour que l'aura n'ait pas de bords nets. */
const AURA_FADE = (() => {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, 128);
  grd.addColorStop(0, '#000'); grd.addColorStop(0.35, '#fff'); grd.addColorStop(0.85, '#fff'); grd.addColorStop(1, '#000');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(c);
})();

function std(color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...extra });
}

function makeFighter(color: number, auraColor: number, x: number): Fighter {
  const root = new THREE.Group();
  root.position.set(x, 0.3, 0);
  root.rotation.y = x < 0 ? Math.PI / 2.4 : -Math.PI / 2.4; // face à face, légèrement tournés vers la caméra

  const body = new THREE.Group();
  root.add(body);
  const mat = std(color);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.9, 6, 16), mat);
  torso.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 16), std(0xf2d0b5));
  head.position.y = 2.1;
  const legGeo = new THREE.CapsuleGeometry(0.16, 0.6, 4, 10);
  const legL = new THREE.Mesh(legGeo, std(INK));
  const legR = legL.clone();
  legL.position.set(-0.18, 0.35, 0);
  legR.position.set(0.18, 0.35, 0);
  const armGeo = new THREE.CapsuleGeometry(0.12, 0.65, 4, 10);
  armGeo.translate(0, -0.4, 0); // pivot à l'épaule
  const armL = new THREE.Mesh(armGeo, mat);
  const armR = new THREE.Mesh(armGeo, mat);
  armL.position.set(-0.55, 1.55, 0);
  armR.position.set(0.55, 1.55, 0);
  body.add(torso, head, legL, legR, armL, armR);
  body.traverse((o) => { o.castShadow = true; });

  // Aura : coques additives qui tournent + particules qui montent.
  const aura = new THREE.Group();
  root.add(aura);
  const shells: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.CylinderGeometry(0.95 + i * 0.25, 0.55 + i * 0.15, 2.8 + i * 0.4, 28, 1, true);
    geo.translate(0, 1.4 + i * 0.2, 0);
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: auraColor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide, depthWrite: false, alphaMap: AURA_FADE,
      }),
    );
    shells.push(m);
    aura.add(m);
  }
  const N = 160;
  const pos = new Float32Array(N * 3);
  const rng = makeRng(x < 0 ? 11 : 12);
  for (let i = 0; i < N; i++) {
    const a = rng() * Math.PI * 2;
    const r = 0.5 + rng() * 0.8;
    pos.set([Math.cos(a) * r, rng() * 3.5, Math.sin(a) * r], i * 3);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const particles = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({
      color: auraColor, size: 0.09, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  aura.add(particles);

  const light = new THREE.PointLight(auraColor, 0, 8, 1.5);
  light.position.y = 1.6;
  root.add(light);

  return { root, body, armL, armR, aura, shells, particles, light };
}

export function createArena(canvas: HTMLCanvasElement, reducedMotion: boolean): Arena {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(INK);
  scene.fog = new THREE.Fog(INK, 24, 48);

  const camera = new THREE.PerspectiveCamera(40, 2, 0.5, 100);
  const CAM_BASE = new THREE.Vector3(0, 4.6, 10.5);
  const LOOK = new THREE.Vector3(0, 1.6, 0);
  let camDist = CAM_BASE.z;

  // ---- Lumières
  scene.add(new THREE.HemisphereLight(0x8899aa, 0x222222, 1.1));
  // éclairage des tribunes, qui monte avec l'ambiance
  const standWash = new THREE.SpotLight(0xfff1d0, 40, 60, 1.0, 0.8, 0.6);
  standWash.position.set(0, 16, 14);
  standWash.target.position.set(0, 3, -12);
  scene.add(standWash, standWash.target);
  const spotBlue = new THREE.SpotLight(BLUE, 60, 30, 0.5, 0.6, 1.2);
  spotBlue.position.set(-7, 9, 5);
  spotBlue.target.position.set(-2, 0, 0);
  const spotRed = new THREE.SpotLight(RED, 60, 30, 0.5, 0.6, 1.2);
  spotRed.position.set(7, 9, 5);
  spotRed.target.position.set(2, 0, 0);
  const spotTop = new THREE.SpotLight(0xffffff, 80, 30, 0.45, 0.5, 1.2);
  spotTop.position.set(0, 12, 2);
  spotTop.castShadow = true;
  spotTop.shadow.mapSize.set(1024, 1024);
  const strobe = new THREE.PointLight(0xffffff, 0, 40, 1);
  strobe.position.set(0, 8, -6);
  scene.add(spotBlue, spotBlue.target, spotRed, spotRed.target, spotTop, strobe);

  // ---- Sol et ring : disque coupé bleu / rouge + bande jaune, comme la DA.
  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), std(0x161616, { roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const halfL = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.3, 48, 1, false, Math.PI, Math.PI), std(0x0b2a40));
  const halfR = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.4, 0.3, 48, 1, false, 0, Math.PI), std(0x40101a));
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 8.6), std(YELLOW, { emissive: YELLOW, emissiveIntensity: 0.4 }));
  stripe.rotation.y = THREE.MathUtils.degToRad(15);
  for (const m of [halfL, halfR, stripe]) { m.position.y = 0.15; m.receiveShadow = true; scene.add(m); }
  const rim = new THREE.Mesh(new THREE.TorusGeometry(4.35, 0.06, 8, 96), std(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.6 }));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.31;
  scene.add(rim);

  // ---- Combattants
  const p1 = makeFighter(BLUE, YELLOW, -1.9);
  const p2 = makeFighter(RED, RED, 1.9);
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

  // ---- Tribunes en gradins + foule instanciée
  const rng = makeRng(7);
  const spectators: Spectator[] = [];
  // Profil en escalier tourné autour de l'axe : chaque rang est une marche (anneau), pas un disque plein
  // qui enterrerait les rangs intérieurs.
  const TIERS = 6, R0 = 8, DEPTH = 1.5, RISE = 0.65;
  const profile: THREE.Vector2[] = [new THREE.Vector2(R0 - DEPTH / 2, 0)];
  for (let k = 0; k < TIERS; k++) {
    const inner = R0 + k * DEPTH - DEPTH / 2;
    if (k > 0) profile.push(new THREE.Vector2(inner, (k - 1) * RISE), new THREE.Vector2(inner, k * RISE));
    profile.push(new THREE.Vector2(inner + DEPTH, k * RISE));
  }
  const last = profile[profile.length - 1];
  profile.push(new THREE.Vector2(last.x, 0)); // mur arrière
  const stands = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 96, GAP, Math.PI * 2 - GAP * 2),
    std(0x121212, { roughness: 1, side: THREE.DoubleSide }),
  );
  stands.position.y = 0.002;
  stands.receiveShadow = true;
  scene.add(stands);
  for (let k = 0; k < TIERS; k++) {
    const R = R0 + k * DEPTH;
    const y = k * RISE;
    const count = Math.floor(((Math.PI * 2 - GAP * 2) * R) / 0.78);
    for (let i = 0; i < count; i++) {
      const th = GAP + ((i + 0.5) / count) * (Math.PI * 2 - GAP * 2) + (rng() - 0.5) * 0.02;
      const r = R + (rng() - 0.5) * 0.3;
      spectators.push({
        x: Math.sin(th) * r, z: Math.cos(th) * r, y, rot: th,
        phase: rng() * Math.PI * 2, speed: 0.8 + rng() * 0.5, hype: rng(),
      });
    }
  }

  const n = spectators.length;
  const bodyGeo = new THREE.CapsuleGeometry(0.24, 0.5, 4, 8);
  bodyGeo.translate(0, 0.5, 0);
  const headGeo = new THREE.SphereGeometry(0.19, 12, 8);
  headGeo.translate(0, 1.18, 0);
  const armGeo = new THREE.CapsuleGeometry(0.07, 0.45, 3, 6);
  armGeo.translate(0, 0.3, 0);
  const crowdMat = std(0xffffff, { emissive: 0x1a1a1a });
  const bodies = new THREE.InstancedMesh(bodyGeo, crowdMat, n);
  const heads = new THREE.InstancedMesh(headGeo, crowdMat.clone(), n);
  const arms = new THREE.InstancedMesh(armGeo, crowdMat.clone(), n * 2);
  const c = new THREE.Color();
  spectators.forEach((s, i) => {
    const base = s.x < 0 ? BLUE : RED;
    c.setHex(base).multiplyScalar(0.55 + rng() * 0.45);
    bodies.setColorAt(i, c);
    arms.setColorAt(i * 2, c);
    arms.setColorAt(i * 2 + 1, c);
    c.setHSL(0.07, 0.35, 0.45 + rng() * 0.3);
    heads.setColorAt(i, c);
  });
  scene.add(bodies, heads, arms);

  // ---- État piloté de l'extérieur, lissé à chaque frame
  let target = 0;
  let level = 0;
  const auraTarget = [0, 0];
  const auraNow = [0, 0];
  let burstT = -10;
  let burstP: 0 | 1 = 0;

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const zero = new THREE.Vector3(0, 0, 0);
  const Y_AXIS = new THREE.Vector3(0, 1, 0);
  const clock = new THREE.Clock();
  const rm = reducedMotion ? 0.25 : 1;

  function lerpParams(l: number) {
    const i = Math.min(3, Math.floor(l));
    const f = l - i;
    const a = CROWD[i];
    const b = CROWD[i + 1];
    return { amp: a.amp + (b.amp - a.amp) * f, speed: a.speed + (b.speed - a.speed) * f, raised: a.raised + (b.raised - a.raised) * f };
  }

  function animateFighter(f: Fighter, t: number, power: number, jump: number) {
    if (f.model) {
      // Le Y Bot a son propre repos et sa danse : pas de saut ni de bras procéduraux.
      f.body.position.y = 0;
    } else {
      const breathe = Math.sin(t * 2) * 0.03;
      f.body.position.y = breathe + jump;
    }
    // bras : le long du corps → levés quand l'aura monte
    const lift = THREE.MathUtils.lerp(0.15, 2.7, Math.min(1, power * 1.3));
    if (!f.model) {
      f.armL.rotation.z = -lift + Math.sin(t * 3) * 0.05;
      f.armR.rotation.z = lift - Math.sin(t * 3) * 0.05;
    }
    f.shells.forEach((s, i) => {
      (s.material as THREE.MeshBasicMaterial).opacity = power * (0.22 - i * 0.05) * (0.85 + Math.sin(t * 6 + i) * 0.15);
      s.rotation.y = t * (0.6 + i * 0.4) * (i % 2 ? -1 : 1);
      s.scale.setScalar(0.6 + power * 0.7);
    });
    const pm = f.particles.material as THREE.PointsMaterial;
    pm.opacity = Math.min(1, power * 1.4);
    pm.size = 0.06 + power * 0.08;
    const pos = f.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
    const speed = 0.01 + power * 0.06;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + speed * rm;
      if (y > 3.6) y = 0;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    f.light.intensity = power * 12;
  }

  let raf = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    level += (target - level) * Math.min(1, dt * 3);
    for (const i of [0, 1]) auraNow[i] += (auraTarget[i] - auraNow[i]) * Math.min(1, dt * 2.5);
    const since = t - burstT;
    p1.model?.mixer.update(dt);
    p2.model?.mixer.update(dt);

    // Foule
    const p = lerpParams(level);
    spectators.forEach((s, i) => {
      const hop = Math.abs(Math.sin(t * p.speed * s.speed + s.phase)) * p.amp * rm;
      const sway = Math.sin(t * 1.3 + s.phase) * 0.05;
      e.set(0, s.rot + Math.PI, sway);
      q.setFromEuler(e);
      v.set(s.x, s.y + hop, s.z);
      m4.compose(v, q, one);
      bodies.setMatrixAt(i, m4);
      heads.setMatrixAt(i, m4);
      const up = s.hype < p.raised;
      for (const side of [-1, 1]) {
        if (up) {
          const wave = Math.sin(t * p.speed + s.phase + side) * 0.25;
          e.set(0, s.rot + Math.PI, side * (0.35 + wave));
          q.setFromEuler(e);
          // épaule, dans le repère du spectateur
          v.set(side * 0.28, 0.82, 0).applyAxisAngle(Y_AXIS, s.rot + Math.PI);
          v.x += s.x; v.y += s.y + hop; v.z += s.z;
          m4.compose(v, q, one);
        } else {
          m4.compose(v.set(s.x, s.y, s.z), q, zero);
        }
        arms.setMatrixAt(i * 2 + (side < 0 ? 0 : 1), m4);
      }
    });
    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    arms.instanceMatrix.needsUpdate = true;

    // Combattants : chacun suit son aura (une petite aura de veille au repos) ; celui qui vient de poser saute.
    const jump = since < 0.6 ? Math.sin((since / 0.6) * Math.PI) * 0.6 * (0.4 + auraNow[burstP]) * rm : 0;
    animateFighter(p1, t, Math.max(0.1, auraNow[0]), burstP === 0 ? jump : 0);
    animateFighter(p2, t + 1.3, Math.max(0.1, auraNow[1]), burstP === 1 ? jump : 0);

    // Lumières
    spotTop.intensity = 40 + level * 25;
    standWash.intensity = 30 + level * 22;
    spotTop.color.setHex(level >= 3 ? YELLOW : 0xffffff);
    strobe.intensity = level > 3.5 && !reducedMotion && Math.random() < 0.08 ? 60 : 0;

    // Caméra : lente orbite, plonge vers le joueur qui vient de poser, tremble au niveau 4.
    const orbit = Math.sin(t * 0.15) * 0.25 * rm;
    const zoom = since < 1.5 ? Math.sin((since / 1.5) * Math.PI) * 2.2 : 0;
    camera.position.set(
      CAM_BASE.x + Math.sin(orbit) * camDist - zoom * 0.6 * (burstP === 0 ? 1 : -1),
      CAM_BASE.y * (camDist / CAM_BASE.z) - zoom * 0.4,
      Math.cos(orbit) * camDist - zoom,
    );
    if (level > 3.5 && !reducedMotion) {
      camera.position.x += (Math.random() - 0.5) * 0.08;
      camera.position.y += (Math.random() - 0.5) * 0.08;
    }
    camera.lookAt(LOOK);
    renderer.render(scene, camera);
  }
  frame();

  let size = { w: 1, h: 1 };
  let framing = { x: 0, y: 0 };
  function applyFrame() {
    const { w, h } = size;
    if (framing.x || framing.y) camera.setViewOffset(w, h, framing.x, framing.y, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  return {
    setLevel(l) { target = Math.max(0, Math.min(4, l)); },
    setAura(p, a) { auraTarget[p] = Math.max(0, Math.min(1, a)); },
    burst(p) {
      burstP = p;
      burstT = clock.elapsedTime;
      startDance(p === 0 ? p1 : p2);
    },
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // On fixe le champ horizontal (~70°) plutôt que le vertical : sur un écran très large, la vue
      // ne s'ouvre pas jusqu'aux bords du vide ; sur un écran étroit, on garde les deux combattants.
      const aspect = w / Math.max(1, h);
      const hfov = THREE.MathUtils.degToRad(70);
      const wanted = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / aspect));
      // Plancher à 28° pour ne pas zoomer sur les combattants ; on compense en reculant la caméra.
      camera.fov = THREE.MathUtils.clamp(wanted, 28, 55);
      camDist = wanted < 28 ? CAM_BASE.z * (1 + (28 - wanted) / 28 * 0.6) : CAM_BASE.z;
      size = { w, h };
      applyFrame();
    },
    setFrame(x, y) {
      framing = { x, y };
      applyFrame();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      for (const f of [p1, p2]) f.model?.mixer.stopAllAction();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat?.dispose();
      });
      renderer.dispose();
    },
  };
}
