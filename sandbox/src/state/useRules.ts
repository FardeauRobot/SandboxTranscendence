import { useCallback, useEffect, useState } from 'react';
import { cloneRules, DEFAULT_RULES } from '../engine/defaultRules';
import type { Rules } from '../engine/types';

const KEY = 'aura-sandbox:rules:v3';
/** v1 : défausses par donne (3). v2 : défausses par match (10), manches et chrono (30 s). v3 : chrono à 45 s. */
const KEY_V1 = 'aura-sandbox:rules:v1';
const KEY_V2 = 'aura-sandbox:rules:v2';

/** Anciens noms de clés (« chips ») → nouveaux (« points »), pour ne pas perdre un réglage sauvegardé ou importé. */
const LEGACY_KEYS: Record<string, string> = { chips: 'points', rankChips: 'rankPoints' };

function renameLegacyKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(renameLegacyKeys);
  if (!v || typeof v !== 'object') return v;
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v)) {
    const nk = LEGACY_KEYS[k] ?? k;
    if (nk !== k && nk in (v as Record<string, unknown>)) continue; // la nouvelle clé gagne
    out[nk] = renameLegacyKeys(val);
  }
  return out;
}

/**
 * Fusionne un objet inconnu (localStorage, fichier importé) avec les règles par défaut :
 * une clé absente ou du mauvais type garde la valeur par défaut, une clé en trop est ignorée.
 */
export function mergeRules(input: unknown, base: Rules = DEFAULT_RULES): Rules {
  input = renameLegacyKeys(input);
  const out = cloneRules(base);
  const walk = (src: unknown, dst: Record<string, unknown>) => {
    if (!src || typeof src !== 'object') return;
    for (const k of Object.keys(dst)) {
      const v = (src as Record<string, unknown>)[k];
      const d = dst[k];
      if (v === undefined) continue;
      if (d && typeof d === 'object') walk(v, d as Record<string, unknown>);
      else if (typeof v === typeof d && (typeof v !== 'number' || Number.isFinite(v))) dst[k] = v;
    }
  };
  walk(input, out as unknown as Record<string, unknown>);
  return out;
}

function load(): Rules {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return mergeRules(JSON.parse(raw));
    const v2 = localStorage.getItem(KEY_V2);
    if (v2) {
      // Un chrono resté à l'ancien défaut (30 s) passe au nouveau ; une valeur choisie à la main est gardée.
      const r = mergeRules(JSON.parse(v2));
      if (r.game.turnSeconds === 30) r.game.turnSeconds = DEFAULT_RULES.game.turnSeconds;
      return r;
    }
    const v1 = localStorage.getItem(KEY_V1);
    if (!v1) return cloneRules(DEFAULT_RULES);
    // On garde les réglages de score ; l'ancien « défausses max » n'a plus le même sens.
    const r = mergeRules(JSON.parse(v1));
    r.game.maxDiscards = DEFAULT_RULES.game.maxDiscards;
    return r;
  } catch {
    return cloneRules(DEFAULT_RULES);
  }
}

export function useRules() {
  const [rules, setRules] = useState<Rules>(load);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(rules)); } catch { /* stockage indisponible : on continue sans */ }
  }, [rules]);

  /** Modifie une copie : `update(r => { r.hands.pair.mult = 3 })`. */
  const update = useCallback((fn: (draft: Rules) => void) => {
    setRules((prev) => {
      const next = cloneRules(prev);
      fn(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => setRules(cloneRules(DEFAULT_RULES)), []);
  const replace = useCallback((r: unknown) => setRules(mergeRules(r)), []);

  return { rules, update, reset, replace };
}
