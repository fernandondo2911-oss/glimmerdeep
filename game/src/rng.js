// Glimmerdeep — deterministic randomness. One job: every random choice in the
// game comes from a seeded generator, so a run (and a screenshot scene) can be
// replayed exactly from its seed.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Stable 0..1 value for one cell of the world: tile art varies per cell without
// storing anything, and the same world always looks the same.
export function hash2(x, y, seed) {
  let h = (seed ^ Math.imul(x + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(y + 0xc2b2ae35, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export function randomInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

export function randomChance(rng, p) {
  return rng() < p;
}

export function randomPick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

export function shuffleInPlace(rng, items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
