// Glimmerdeep — tuning, palette and world constants. One job: every number the
// rest of the game agrees on lives here, so balance changes touch one file.

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const TILE = 40;
export const COLS = 48;
export const ROWS = 66;
export const SURFACE_ROW = 1; // rows 0-1 are the open surface; digging starts at row 2
export const WORLD_W = COLS * TILE;
export const WORLD_H = ROWS * TILE;
export const SHAFT_COL = 24; // the mine shaft from the surface
export const HEART_CELL = { x: 24, y: 63 }; // the Heart Crystal's cell

// Tile ids. Open tiles are walkable; solid tiles block movement.
export const T = {
  AIR: 0,
  DIRT: 1,
  ROCK: 2,
  HARD_ROCK: 3,
  BOULDER: 4,
  LAVA: 5,
  BEDROCK: 6,
  GEM_AMBER: 7,
  GEM_TEAL: 8,
  GEM_VIOLET: 9,
  HEART: 10,
  GRASS: 11,
};

export const OPEN_TILES = new Set([T.AIR, T.GRASS, T.HEART]);

// Depth bands: name, where each ends (row), darkness, and what spawns there.
export const BANDS = [
  { until: 14, name: 'Topsoil', darkness: 0.34, wispCap: 0, lava: 0, hardChance: 0 },
  { until: 29, name: 'Old Workings', darkness: 0.52, wispCap: 3, lava: 0, hardChance: 0.12 },
  { until: 45, name: 'Crystal Deep', darkness: 0.66, wispCap: 5, lava: 0.05, hardChance: 0.35 },
  { until: 59, name: 'The Gloaming', darkness: 0.78, wispCap: 7, lava: 0.09, hardChance: 0.55 },
  { until: 66, name: 'Heart Chamber', darkness: 0.6, wispCap: 4, lava: 0.04, hardChance: 0.4 },
];

export function bandAt(row) {
  for (const band of BANDS) if (row <= band.until) return band;
  return BANDS[BANDS.length - 1];
}

export const GEM_VALUES = { [T.GEM_AMBER]: 10, [T.GEM_TEAL]: 25, [T.GEM_VIOLET]: 50 };

export const PALETTE = {
  skyTop: '#2b1e4f',
  skyMid: '#7a3b5e',
  skyLow: '#e08a4c',
  hillFar: '#3a2a55',
  hillNear: '#2c2145',
  dirt: '#6b4a2f',
  dirtDark: '#543824',
  rock: '#4a4460',
  rockDark: '#39344e',
  hardRock: '#33304a',
  bedrock: '#1c1930',
  grass: '#5f8f4d',
  grassDark: '#4a703d',
  wood: '#8a5a33',
  woodDark: '#6e4525',
  amber: '#ffb43a',
  teal: '#39d6c0',
  violet: '#b678ff',
  lava: '#ff6a2a',
  lavaCore: '#ffd23a',
  heart: '#ff5d8f',
  lantern: '#ffd98a',
  ink: '#14101f',
  paper: '#f5eeda',
  hudBg: 'rgba(12, 9, 24, 0.72)',
  hudLine: 'rgba(245, 238, 218, 0.25)',
};

export const TUNING = {
  moveTime: 0.15, // seconds to step one cell (before Boots)
  bootsStep: 0.025, // move time removed per Boots tier
  digTime: { [T.DIRT]: 0.32, [T.ROCK]: 0.62, [T.HARD_ROCK]: 1.05, [T.GEM_AMBER]: 0.62, [T.GEM_TEAL]: 0.62, [T.GEM_VIOLET]: 0.62 },
  drillStep: 0.22, // dig time multiplier removed per Drill tier (x0.78, x0.56, x0.34)
  oxygenMax: 100,
  oxygenTankStep: 40,
  oxygenDrain: 1.05, // per second underground, before depth scaling
  oxygenDepthScale: 0.012, // extra drain per row of depth
  oxygenRefill: 30, // per second at the surface
  oxygenCanister: 40,
  heartsMax: 3,
  invulnTime: 1.2,
  swingTime: 0.26,
  swingCooldown: 0.34,
  wispHp: 2,
  wispScore: 25,
  wispHeartChance: 0.3,
  wispStepTime: 0.55, // seconds per wisp grid step (faster deeper)
  wispAggro: 11, // cells
  boulderWobble: 0.35,
  boulderFallStep: 0.09,
  lanternRadius: 165,
  lanternStep: 48, // radius added per Lantern tier
  winBonus: 1000,
  depthBonus: 20, // score per metre of max depth
  respawnTime: 18, // seconds between wisp respawns while below cap
};

export const SHOP_PRICES = {
  tank: [30, 60, 100],
  drill: [40, 80, 130],
  lantern: [30, 55, 90],
  boots: [25, 50, 85],
  plating: [50, 90, 140],
};
