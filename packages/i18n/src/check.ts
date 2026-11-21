type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** Flattens a nested messages object into dot-separated keys -> string values. */
export function flatten(obj: Json, prefix = ''): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (obj !== null && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        for (const [ik, iv] of flatten(v, key)) out.set(ik, iv);
      } else {
        out.set(key, v);
      }
    }
  }
  return out;
}

export interface CompletenessReport {
  missing: string[];
  extra: string[];
  empty: string[];
  nonString: string[];
}

/** Compares a target dictionary against the reference one (ru). */
export function compareMessages(reference: Json, target: Json): CompletenessReport {
  const ref = flatten(reference);
  const tgt = flatten(target);
  const missing = [...ref.keys()].filter((k) => !tgt.has(k));
  const extra = [...tgt.keys()].filter((k) => !ref.has(k));
  const empty: string[] = [];
  const nonString: string[] = [];
  for (const [k, v] of tgt) {
    if (typeof v !== 'string') nonString.push(k);
    else if (v.trim() === '') empty.push(k);
  }
  return { missing, extra, empty, nonString };
}

export function isComplete(r: CompletenessReport): boolean {
  return !r.missing.length && !r.extra.length && !r.empty.length && !r.nonString.length;
}
