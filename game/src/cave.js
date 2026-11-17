// Glimmerdeep — the underground. One job: grow a cave from a seed (tunnels,
// rooms, gem veins, lava, boulders, pickups, the Heart Chamber), answer what
// each cell holds, and make boulders fall when their support is dug away.

import { COLS, ROWS, SHAFT_COL, HEART_CELL, T, BANDS, bandAt, TUNING } from './config.js';
import { mulberry32, randomInt, randomChance, randomPick } from './rng.js';

export function cellKey(x, y) {
  return x + ',' + y;
}

export function tileAt(cave, x, y) {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return T.BEDROCK;
  return cave.tiles[y * COLS + x];
}

export function setTile(cave, x, y, tile) {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return;
  cave.tiles[y * COLS + x] = tile;
}

export function isOpenTile(tile) {
  return tile === T.AIR || tile === T.GRASS || tile === T.HEART;
}

export function isDiggable(tile, drillTier) {
  if (tile === T.DIRT || tile === T.ROCK || tile === T.GEM_AMBER || tile === T.GEM_TEAL || tile === T.GEM_VIOLET) return true;
  if (tile === T.HARD_ROCK) return drillTier >= 1;
  if (tile === T.BOULDER) return drillTier >= 3;
  return false;
}

export function digTimeFor(tile, drillTier) {
  const base = tile === T.BOULDER ? 1.4 : TUNING.digTime[tile];
  if (base === undefined) return Infinity;
  return base * Math.max(0.3, 1 - TUNING.drillStep * drillTier);
}

export function generateCave(seed) {
  const rng = mulberry32(seed);
  const tiles = new Uint8Array(COLS * ROWS);
  tiles.fill(T.ROCK);

  // The surface: open sky over walkable grass, bedrock at the edges and floor.
  for (let x = 0; x < COLS; x++) {
    tiles[0 * COLS + x] = T.AIR;
    tiles[1 * COLS + x] = T.GRASS;
  }
  for (let y = 0; y < ROWS; y++) {
    tiles[y * COLS + 0] = T.BEDROCK;
    tiles[y * COLS + (COLS - 1)] = T.BEDROCK;
  }
  for (let x = 0; x < COLS; x++) tiles[(ROWS - 1) * COLS + x] = T.BEDROCK;

  const cave = {
    seed,
    tiles,
    pickups: [],
    wispSpawns: [],
    digWear: new Map(),
    boulderWobble: new Map(),
    boulderFalling: new Set(),
  };
  const carve = (x, y) => {
    if (x > 0 && x < COLS - 1 && y > 1 && y < ROWS - 1) setTile(cave, x, y, T.AIR);
  };

  // The mine shaft drops from the surface.
  for (let y = 2; y <= 7; y++) carve(SHAFT_COL, y);

  // A guaranteed winding path from the shaft to the Heart Chamber, so the
  // goal is always reachable. pathX[row] remembers the route for connectors.
  const pathX = new Array(ROWS).fill(SHAFT_COL);
  let px = SHAFT_COL;
  for (let y = 8; y <= 60; y++) {
    if (y > 54) px += Math.sign(SHAFT_COL - px);
    else px += randomPick(rng, [-1, 0, 0, 1, 0]);
    px = Math.max(3, Math.min(COLS - 4, px));
    pathX[y] = px;
    carve(px, y);
    if (randomChance(rng, 0.35)) carve(px + 1, y);
  }

  // Rooms with an L-shaped connector back to the guaranteed path.
  const rooms = [];
  for (let i = 0; i < 17; i++) {
    const w = randomInt(rng, 3, 6);
    const h = randomInt(rng, 3, 4);
    const rx = randomInt(rng, 2, COLS - 2 - w);
    const ry = randomInt(rng, 8, 55 - h);
    for (let y = ry; y < ry + h; y++) {
      for (let x = rx; x < rx + w; x++) carve(x, y);
    }
    const cx = rx + Math.floor(w / 2);
    const cy = ry + Math.floor(h / 2);
    rooms.push({ cx, cy });
    const targetX = pathX[cy];
    const step = Math.sign(targetX - cx);
    for (let x = cx; x !== targetX + step; x += step || 1) {
      carve(x, cy);
      if (step === 0) break;
    }
  }

  // Hard rock deepens with depth; gems are seeded after, so veins survive.
  for (let y = 15; y < ROWS - 1; y++) {
    const band = bandAt(y);
    for (let x = 1; x < COLS - 1; x++) {
      if (tileAt(cave, x, y) === T.ROCK && randomChance(rng, band.hardChance)) {
        setTile(cave, x, y, T.HARD_ROCK);
      }
    }
  }

  const solidNeighborsOpen = (x, y) => {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (isOpenTile(tileAt(cave, x + dx, y + dy))) return true;
    }
    return false;
  };

  // Gem veins hug open ground, richer the deeper you go.
  const veinBands = [
    { from: 3, to: 14, kinds: [T.GEM_AMBER], count: 26 },
    { from: 15, to: 29, kinds: [T.GEM_AMBER, T.GEM_TEAL], count: 30 },
    { from: 30, to: 45, kinds: [T.GEM_TEAL, T.GEM_VIOLET, T.GEM_AMBER], count: 32 },
    { from: 46, to: 59, kinds: [T.GEM_VIOLET, T.GEM_TEAL], count: 30 },
  ];
  for (const band of veinBands) {
    let placed = 0;
    let tries = 0;
    while (placed < band.count && tries < 900) {
      tries++;
      const x = randomInt(rng, 2, COLS - 3);
      const y = randomInt(rng, band.from, band.to);
      const tile = tileAt(cave, x, y);
      if ((tile === T.ROCK || tile === T.HARD_ROCK) && solidNeighborsOpen(x, y)) {
        const kind = randomPick(rng, band.kinds);
        setTile(cave, x, y, kind);
        placed++;
        if (randomChance(rng, 0.4)) {
          const nx = x + randomPick(rng, [-1, 1]);
          const ny = y + randomPick(rng, [-1, 0, 1]);
          const nt = tileAt(cave, nx, ny);
          if (nt === T.ROCK || nt === T.HARD_ROCK) setTile(cave, nx, ny, kind);
        }
      }
    }
  }

  // Lava pockets glow in the deep bands, never on the open path itself.
  for (let y = 30; y < 60; y++) {
    const band = bandAt(y);
    for (let x = 2; x < COLS - 2; x++) {
      const tile = tileAt(cave, x, y);
      if ((tile === T.ROCK || tile === T.HARD_ROCK) && solidNeighborsOpen(x, y) && randomChance(rng, band.lava)) {
        setTile(cave, x, y, T.LAVA);
        if (randomChance(rng, 0.5)) {
          const nx = x + randomPick(rng, [-1, 1]);
          const nt = tileAt(cave, nx, y);
          if (nt === T.ROCK || nt === T.HARD_ROCK) setTile(cave, nx, y, T.LAVA);
        }
      }
    }
  }

  // Boulders rest on solid ground off the guaranteed path.
  let boulders = 0;
  let tries = 0;
  while (boulders < 15 && tries < 600) {
    tries++;
    const x = randomInt(rng, 2, COLS - 3);
    const y = randomInt(rng, 10, 57);
    if (tileAt(cave, x, y) === T.AIR && !isOpenTile(tileAt(cave, x, y + 1)) && pathX[y] !== x) {
      setTile(cave, x, y, T.BOULDER);
      boulders++;
    }
  }

  // The Heart Chamber: a bedrock ring with one entrance, the Heart within.
  for (let y = 60; y <= 64; y++) {
    for (let x = 19; x <= 29; x++) {
      const edge = x === 19 || x === 29 || y === 64;
      setTile(cave, x, y, edge ? T.BEDROCK : T.AIR);
    }
  }
  setTile(cave, SHAFT_COL, 60, T.AIR); // entrance from the path above
  setTile(cave, HEART_CELL.x, HEART_CELL.y, T.HEART);
  setTile(cave, HEART_CELL.x, HEART_CELL.y + 1, T.BEDROCK);

  // Pickups reward exploring away from the main route.
  const placePickups = (kind, count, fromRow, toRow) => {
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < 800) {
      attempts++;
      const x = randomInt(rng, 2, COLS - 3);
      const y = randomInt(rng, fromRow, toRow);
      if (tileAt(cave, x, y) !== T.AIR || pathX[y] === x) continue;
      if (cave.pickups.some((p) => Math.abs(p.x - x) + Math.abs(p.y - y) < 4)) continue;
      cave.pickups.push({ x, y, kind });
      placed++;
    }
  };
  placePickups('oxygen', 12, 6, 58);
  placePickups('heart', 5, 12, 56);

  // Wisp spawn points, spread through the deep open ground.
  tries = 0;
  while (cave.wispSpawns.length < 10 && tries < 800) {
    tries++;
    const x = randomInt(rng, 2, COLS - 3);
    const y = randomInt(rng, 15, 58);
    if (tileAt(cave, x, y) !== T.AIR) continue;
    if (cave.wispSpawns.some((s) => Math.abs(s.x - x) + Math.abs(s.y - y) < 7)) continue;
    cave.wispSpawns.push({ x, y });
  }
  void BANDS;
  return cave;
}

// Boulders: a boulder with open ground below wobbles, then falls a cell at a
// time. One that lands on solid ground thuds; one that falls onto the player
// shatters and hurts. Runs bottom-up so a boulder moves at most once a tick.
export function updateBoulders(cave, player, dt, events) {
  for (let y = ROWS - 2; y >= 2; y--) {
    for (let x = 1; x < COLS - 1; x++) {
      if (tileAt(cave, x, y) !== T.BOULDER) continue;
      const key = cellKey(x, y);
      const below = tileAt(cave, x, y + 1);
      const playerBelow = player.gx === x && player.gy === y + 1;
      const falling = cave.boulderFalling.has(key);
      if (playerBelow && falling) {
        setTile(cave, x, y, T.AIR);
        cave.boulderFalling.delete(key);
        cave.boulderWobble.delete(key);
        events.push({ type: 'boulder-shatter', x, y });
        events.push({ type: 'hurt', source: 'boulder', x, y: y + 1 });
        continue;
      }
      if (isOpenTile(below) && below !== T.HEART && !playerBelow) {
        const wobble = (cave.boulderWobble.get(key) || 0) + dt;
        if (wobble >= TUNING.boulderWobble) {
          setTile(cave, x, y, T.AIR);
          setTile(cave, x, y + 1, T.BOULDER);
          cave.boulderWobble.delete(key);
          cave.boulderFalling.add(cellKey(x, y + 1));
          const pickup = cave.pickups.findIndex((p) => p.x === x && p.y === y + 1);
          if (pickup >= 0) cave.pickups.splice(pickup, 1);
        } else {
          cave.boulderWobble.set(key, wobble);
        }
      } else {
        if (falling) {
          cave.boulderFalling.delete(key);
          events.push({ type: 'boulder-land', x, y });
        }
        cave.boulderWobble.delete(key);
      }
    }
  }
}
