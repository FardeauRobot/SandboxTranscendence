/**
 * Une apparence n'est utilisable que si les danses s'y appliquent : chaque piste des clips de
 * all_dances.glb doit trouver son os, par son nom, dans le GLB de l'apparence.
 */
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';

const MODELS = new URL('../../../public/models/', import.meta.url);

/** Lit un GLB de public/models et le passe au GLTFLoader, sans serveur. */
function load(file: string): Promise<GLTF> {
  const buf = readFileSync(new URL(file, MODELS));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((ok, ko) => new GLTFLoader().parse(ab, '', ok, ko));
}

/** Noms des os visés par les pistes (« mixamorigHips.quaternion » → « mixamorigHips »). */
function trackedNodes(clips: THREE.AnimationClip[]): Set<string> {
  const names = new Set<string>();
  for (const c of clips) for (const t of c.tracks) names.add(THREE.PropertyBinding.parseTrackName(t.name).nodeName);
  return names;
}

describe('apparences', () => {
  it('Volt porte tous les os animés par les danses', async () => {
    const [bank, volt] = await Promise.all([load('all_dances.glb'), load('skins/volt.glb')]);
    const bones = new Set<string>();
    volt.scene.traverse((o) => { if ((o as THREE.Bone).isBone) bones.add(o.name); });
    const missing = [...trackedNodes(bank.animations)].filter((n) => !bones.has(n));
    expect(missing).toEqual([]);
    expect(volt.animations).toHaveLength(0); // les clips restent dans all_dances.glb
  });

  it('Volt est un seul mesh skinné, aux matériaux propres', async () => {
    const volt = await load('skins/volt.glb');
    const meshes: THREE.SkinnedMesh[] = [];
    volt.scene.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(o as THREE.SkinnedMesh); });
    expect(meshes.length).toBeGreaterThan(0);
    const mats = new Set(meshes.flatMap((m) => (Array.isArray(m.material) ? m.material : [m.material]).map((x) => x.name)));
    expect(mats).toContain('volt_led');
    expect(mats).toContain('volt_white');
  });
});
