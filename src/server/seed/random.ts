/** Deterministic PRNG (mulberry32) seeded from a string, so the same profile always generates the same data. */
export interface Random {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** True with probability `p`. */
  chance(p: number): boolean;
  /** Picks an item with probability proportional to its weight. */
  weighted<T>(items: readonly (readonly [T, number])[]): T;
}

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function createRandom(seed: string): Random {
  let state = hashString(seed);
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const weighted = <T,>(items: readonly (readonly [T, number])[]): T => {
    let roll = next() * items.reduce((sum, [, weight]) => sum + weight, 0);
    for (const [item, weight] of items) {
      roll -= weight;
      if (roll < 0) return item;
    }
    return items[items.length - 1]![0];
  };
  return { next, int, pick: (items) => items[int(0, items.length - 1)]!, chance: (p) => next() < p, weighted };
}
