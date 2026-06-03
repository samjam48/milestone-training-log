// =============================================================================
// cn — classnames helper
// -----------------------------------------------------------------------------
// Lightweight stand-in for `clsx`/`classnames`. Accepts strings, falsy values,
// and dict-of-bool. Skips a runtime dep for ~30 lines.
// =============================================================================

type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | Record<string, boolean | null | undefined>
  | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const v of inputs) {
    if (!v) continue;
    if (typeof v === 'string' || typeof v === 'number') {
      out.push(String(v));
    } else if (Array.isArray(v)) {
      const nested = cn(...v);
      if (nested) out.push(nested);
    } else if (typeof v === 'object') {
      for (const k of Object.keys(v)) if (v[k]) out.push(k);
    }
  }
  return out.join(' ');
}
