// Glimmerdeep — deterministic screenshot scenes. One job: put the real game,
// through its real rendering, into the exact states the screenshots show, from
// a seed and fixed simulated time: ?shot=start|play|victory|defeat&seed=<n>.
// Nothing here draws anything the game itself would not draw while playing.

import { TILE, COLS, T, PALETTE } from './config.js';
import { mulberry32 } from './rng.js';
import { tileAt, setTile, isOpenTile, isDiggable, cellKey } from './cave.js';
import { startRun, startTitleScene, finishRun, updateCamera } from './game.js';
import { makeWisp } from './hazards.js';
import { burst, floater, updateParticles } from './particles.js';

function setCell(player, x, y) {
  player.gx = x;
  player.gy = y;
  player.px = x * TILE + TILE / 2;
  player.py = y * TILE + TILE / 2;
  player.move = null;
}

function firstOpenCell(cave, fromRow, toRow) {
  for (let y = fromRow; y <= toRow; y++) {
    for (let x = 4; x < COLS - 4; x++) {
      if (tileAt(cave, x, y) === T.AIR) return { x, y };
    }
  }
  return { x: 24, y: fromRow };
}

function preStepParticles(game, steps) {
  for (let i = 0; i < steps; i++) updateParticles(game.particles, 1 / 60, null);
}

function stageTitle(game) {
  startTitleScene(game);
  game.time = 3.2;
  game.camera = { x: 160, y: 0 };
  burst(game.particles, 18 * TILE + 28, 1 * TILE - 8, { color: PALETTE.lantern, count: 6, speed: 20, life: 1.8, size: 3, gravity: -14 });
  preStepParticles(game, 30);
}

function stagePlay(game, seed) {
  startRun(game, seed);
  game.time = 12.5;
  const { cave, player } = game;
  const stage = firstOpenCell(cave, 22, 26);
  setCell(player, stage.x, stage.y);
  player.maxDepth = stage.y - 1;
  // Make sure the frame is rich: at least three gems in view.
  let gems = 0;
  for (let y = stage.y - 8; y <= stage.y + 8; y++) {
    for (let x = stage.x - 12; x <= stage.x + 12; x++) {
      const tile = tileAt(cave, x, y);
      if (tile === T.GEM_AMBER || tile === T.GEM_TEAL || tile === T.GEM_VIOLET) gems++;
    }
  }
  const gemKinds = [T.GEM_TEAL, T.GEM_AMBER, T.GEM_VIOLET];
  let placed = 0;
  for (let y = stage.y - 7; y <= stage.y + 7 && gems + placed < 4; y++) {
    for (let x = stage.x - 11; x <= stage.x + 11 && gems + placed < 4; x++) {
      if (tileAt(cave, x, y) !== T.ROCK) continue;
      const nearOpen = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isOpenTile(tileAt(cave, x + dx, y + dy)));
      if (!nearOpen) continue;
      setTile(cave, x, y, gemKinds[placed % gemKinds.length]);
      placed++;
    }
  }
  // Mid-dig on a gem next to the delver, progress ring half full.
  const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1], [0, -1]];
  let digCell = null;
  for (const [dx, dy] of neighbors) {
    const tile = tileAt(cave, stage.x + dx, stage.y + dy);
    if (tile === T.GEM_AMBER || tile === T.GEM_TEAL || tile === T.GEM_VIOLET) {
      digCell = { x: stage.x + dx, y: stage.y + dy, tile };
      break;
    }
  }
  if (!digCell) {
    for (const [dx, dy] of neighbors) {
      const x = stage.x + dx;
      const y = stage.y + dy;
      if (tileAt(cave, x, y) === T.ROCK) {
        setTile(cave, x, y, T.GEM_TEAL);
        digCell = { x, y, tile: T.GEM_TEAL };
        break;
      }
    }
  }
  if (digCell) {
    player.facing = { dx: digCell.x - stage.x, dy: digCell.y - stage.y };
    player.digging = { x: digCell.x, y: digCell.y, total: 0.62 };
    cave.digWear.set(cellKey(digCell.x, digCell.y), 0.34);
    burst(game.particles, digCell.x * TILE + TILE / 2, digCell.y * TILE + TILE / 2, {
      color: PALETTE.teal, count: 12, speed: 110, life: 0.6, size: 4,
    });
    floater(game.particles, digCell.x * TILE + TILE / 2, digCell.y * TILE - 6, '+25', PALETTE.teal);
  }
  // Two wisps closing in, and a played-run HUD.
  game.wisps = [];
  const rng = mulberry32(seed + 5);
  let wispsPlaced = 0;
  for (let y = stage.y - 6; y <= stage.y + 6 && wispsPlaced < 2; y++) {
    for (let x = stage.x - 8; x <= stage.x + 8 && wispsPlaced < 2; x++) {
      const dist = Math.abs(x - stage.x) + Math.abs(y - stage.y);
      if (dist >= 3 && dist <= 6 && tileAt(cave, x, y) === T.AIR) {
        game.wisps.push(makeWisp(x, y, rng));
        wispsPlaced++;
      }
    }
  }
  player.oxygen = 68;
  player.gems = 47;
  player.score = 1230;
  player.gemsGathered = 215;
  player.wispsFelled = 2;
  player.hearts = 3;
  player.upgrades.drill = 1;
  player.upgrades.lantern = 1;
  game.runTime = 187;
  game.hint = 'WASD dig & move · Space swing · click a next-door cell · E at the tent';
  updateCamera(game, 0, true);
  preStepParticles(game, 18);
}

function stageVictory(game, seed) {
  startRun(game, seed);
  game.time = 8;
  const { player } = game;
  setCell(player, 24, 61);
  player.score = 2140;
  player.gemsGathered = 890;
  player.gems = 120;
  player.maxDepth = 62;
  player.wispsFelled = 6;
  player.hearts = 2;
  player.oxygen = 41;
  game.runTime = 431;
  updateCamera(game, 0, true);
  finishRun(game, true, 'The Heart Crystal is yours — the village will shine again.');
  preStepParticles(game, 30);
}

function stageDefeat(game, seed) {
  startRun(game, seed);
  game.time = 8;
  const { cave, player } = game;
  const stage = firstOpenCell(cave, 29, 32);
  setCell(player, stage.x, stage.y);
  player.score = 640;
  player.gemsGathered = 210;
  player.gems = 18;
  player.maxDepth = 29;
  player.wispsFelled = 1;
  player.hearts = 0;
  player.oxygen = 0;
  game.runTime = 263;
  updateCamera(game, 0, true);
  burst(game.particles, player.px, player.py, { color: '#8a86a0', count: 10, speed: 40, life: 1.2, size: 3, gravity: -20 });
  finishRun(game, false, 'The dark closed in — out of air.');
  preStepParticles(game, 20);
}

export function applyShot(game, scene, seed) {
  game.shotMode = true;
  game.particles.rng = mulberry32(seed * 7919 + 13);
  if (scene === 'start') stageTitle(game);
  else if (scene === 'play') stagePlay(game, seed);
  else if (scene === 'victory') stageVictory(game, seed);
  else if (scene === 'defeat') stageDefeat(game, seed);
  else throw new Error(`unknown shot scene: ${scene}`);
}
