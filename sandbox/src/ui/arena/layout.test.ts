import { Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT, mergeLayout, yaw } from './layout';

describe('mergeLayout', () => {
  it('rend la disposition par défaut pour une entrée vide ou absurde', () => {
    expect(mergeLayout(undefined)).toEqual(DEFAULT_LAYOUT);
    expect(mergeLayout('nope')).toEqual(DEFAULT_LAYOUT);
    expect(mergeLayout({ fighters: 'x', camera: null })).toEqual(DEFAULT_LAYOUT);
  });

  it('reprend les valeurs valides et garde le défaut ailleurs', () => {
    const l = mergeLayout({ camera: { base: [1, 2, 3] }, fighters: [{ rotY: 0.5 }] });
    expect(l.camera.base).toEqual([1, 2, 3]);
    expect(l.camera.look).toEqual(DEFAULT_LAYOUT.camera.look);
    expect(l.fighters[0]).toEqual({ pos: DEFAULT_LAYOUT.fighters[0].pos, rotY: 0.5 });
    expect(l.fighters[1]).toEqual(DEFAULT_LAYOUT.fighters[1]);
  });

  it('refuse les nombres non finis et les mauvais types, ignore les clés en trop', () => {
    const l = mergeLayout({ lights: { strobe: { pos: [Infinity, '4', 5] }, disco: { pos: [0, 0, 0] } } });
    expect(l.lights.strobe.pos).toEqual([DEFAULT_LAYOUT.lights.strobe.pos[0], DEFAULT_LAYOUT.lights.strobe.pos[1], 5]);
    expect('disco' in l.lights).toBe(false);
  });

  it('ne modifie pas la disposition par défaut', () => {
    const before = JSON.stringify(DEFAULT_LAYOUT);
    mergeLayout({ camera: { base: [9, 9, 9] } }).camera.look[0] = 42;
    expect(JSON.stringify(DEFAULT_LAYOUT)).toBe(before);
  });

  it('relit sans perte un JSON exporté', () => {
    const l = mergeLayout({ fighters: [{ pos: [-3, 0.3, 1], rotY: 2.5 }] });
    expect(mergeLayout(JSON.parse(JSON.stringify(l)))).toEqual(l);
  });
});

describe('yaw', () => {
  it('retrouve l’orientation autour de la verticale, y compris au-delà de 90°', () => {
    for (const a of [0, 0.4, Math.PI / 2.4, 2.5, -2.9, -Math.PI / 2]) {
      const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), a);
      expect(yaw(q)).toBeCloseTo(a, 6);
    }
  });
});
