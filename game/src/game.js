// Glimmerdeep — the game itself. One job: own the state machine (title,
// playing, paused, shop, victory, defeat), feed the player and the hazards,
// answer every event with sound, particles and toasts, and keep the camera on
// the delver.

import {
  VIEW_W, VIEW_H, TILE, SHAFT_COL, SURFACE_ROW, T, WORLD_W, WORLD_H,
  PALETTE, TUNING,
} from './config.js';
import { mulberry32 } from './rng.js';
import { createAudio, ensureAudioContext, playSound, toggleAudioMuted } from './audio.js';
import { createInput, endFrameInput, wasPressed } from './input.js';
import { generateCave, tileAt, isOpenTile, isDiggable, updateBoulders } from './cave.js';
import { createPlayer, updatePlayer, applyDamage } from './player.js';
import { spawnWisps, updateWisps, banishWisp, maybeRespawnWisps } from './hazards.js';
import { createParticles, burst, floater, addShake, updateParticles } from './particles.js';
import { drawWorld } from './render.js';
import { drawHUD, drawToasts, drawTitle, drawPause, drawShopPanel, drawEndScreen, buttonAt as uiButtonAt } from './ui.js';
import { buyUpgrade, restAtTent, UPGRADES } from './shop.js';

const BEST_KEY = 'glimmerdeep_best_v1';
const TITLE_SEED = 20261117;

export function loadBest() {
  try {
    const raw = window.localStorage.getItem(BEST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { score: parsed.score || 0, depth: parsed.depth || 0, wins: parsed.wins || 0 };
    }
  } catch { /* storage unavailable: play without records */ }
  return { score: 0, depth: 0, wins: 0 };
}

export function saveBest(best) {
  try {
    window.localStorage.setItem(BEST_KEY, JSON.stringify(best));
  } catch { /* ignore */ }
}

export function createGame(canvas) {
  const game = {
    canvas,
    ctx: canvas.getContext('2d'),
    input: createInput(canvas),
    audio: createAudio(),
    particles: createParticles(),
    state: 'title',
    stateTime: 0,
    cave: null,
    player: null,
    wisps: [],
    camera: { x: 0, y: 0 },
    time: 0,
    runTime: 0,
    seed: TITLE_SEED,
    rng: mulberry32(TITLE_SEED),
    respawnTimer: { left: TUNING.respawnTime },
    best: loadBest(),
    toasts: [],
    buttons: [],
    hint: '',
    endReason: '',
    finalScore: 0,
    newBest: false,
    beepTimer: 0,
    celebrateTimer: 0,
    shotMode: false,
  };
  startTitleScene(game);
  return game;
}

export function startTitleScene(game) {
  game.state = 'title';
  game.stateTime = 0;
  game.seed = TITLE_SEED;
  game.rng = mulberry32(TITLE_SEED);
  game.cave = generateCave(TITLE_SEED);
  game.player = createPlayer(SHAFT_COL, SURFACE_ROW);
  game.wisps = [];
  game.toasts = [];
  game.camera = { x: 160, y: 0 };
  game.runTime = 0;
}

export function startRun(game, seed) {
  game.seed = seed === undefined ? (Math.random() * 2147483647) | 0 : seed;
  game.rng = mulberry32(game.seed);
  game.cave = generateCave(game.seed);
  game.player = createPlayer(SHAFT_COL, SURFACE_ROW);
  game.wisps = spawnWisps(game.cave, game.rng, 4);
  game.particles.list.length = 0;
  game.particles.floaters.length = 0;
  game.particles.shake = 0;
  game.toasts = [];
  game.runTime = 0;
  game.stateTime = 0;
  game.respawnTimer.left = TUNING.respawnTime;
  game.state = 'playing';
  updateCamera(game, 0, true);
  pushToast(game, 'Find the Heart Crystal, 62m down. Mind your air!', PALETTE.amber);
}

export function finalScoreOf(game, won) {
  return game.player.score + game.player.maxDepth * TUNING.depthBonus + (won ? TUNING.winBonus : 0);
}

export function finishRun(game, won, reason) {
  const { player } = game;
  game.finalScore = finalScoreOf(game, won);
  game.newBest = game.finalScore > game.best.score;
  game.best.score = Math.max(game.best.score, game.finalScore);
  game.best.depth = Math.max(game.best.depth, player.maxDepth);
  if (won) game.best.wins += 1;
  saveBest(game.best);
  game.endReason = reason;
  game.state = won ? 'victory' : 'defeat';
  game.stateTime = 0;
  game.celebrateTimer = 0;
  playSound(game.audio, won ? 'win' : 'lose');
  if (won) {
    for (let i = 0; i < 6; i++) {
      burst(game.particles, player.px + (game.rng() * 2 - 1) * 220, player.py - 60 - game.rng() * 120, {
        color: [PALETTE.amber, PALETTE.teal, PALETTE.violet, PALETTE.heart][i % 4],
        count: 22, speed: 90, life: 1.6, size: 5, gravity: 60,
      });
    }
    addShake(game.particles, 6);
  }
}

export function pushToast(game, text, color = PALETTE.paper) {
  game.toasts.push({ text, color, life: 3.2 });
  if (game.toasts.length > 3) game.toasts.shift();
}

export function updateCamera(game, dt, snap = false) {
  const { player } = game;
  const tx = Math.max(0, Math.min(WORLD_W - VIEW_W, player.px - VIEW_W / 2));
  const ty = Math.max(0, Math.min(WORLD_H - VIEW_H, player.py - VIEW_H / 2));
  if (snap) {
    game.camera.x = tx;
    game.camera.y = ty;
    return;
  }
  const k = Math.min(1, dt * 8);
  game.camera.x += (tx - game.camera.x) * k;
  game.camera.y += (ty - game.camera.y) * k;
}

function tileChipColor(tile) {
  if (tile === T.DIRT) return PALETTE.dirt;
  if (tile === T.HARD_ROCK) return '#3e3a58';
  if (tile === T.BOULDER) return '#6c6684';
  if (tile === T.GEM_AMBER) return PALETTE.amber;
  if (tile === T.GEM_TEAL) return PALETTE.teal;
  if (tile === T.GEM_VIOLET) return PALETTE.violet;
  return PALETTE.rock;
}

function onScreen(game, x, y) {
  const sx = x * TILE - game.camera.x;
  const sy = y * TILE - game.camera.y;
  return sx > -TILE && sx < VIEW_W && sy > -TILE && sy < VIEW_H;
}

function processEvents(game, events) {
  const { player, cave } = game;
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const cx = event.x !== undefined ? event.x * TILE + TILE / 2 : player.px;
    const cy = event.y !== undefined ? event.y * TILE + TILE / 2 : player.py;
    switch (event.type) {
      case 'step':
        playSound(game.audio, 'step');
        break;
      case 'dig-tick':
        playSound(game.audio, 'digTick');
        burst(game.particles, cx, cy, { color: tileChipColor(event.tile), count: 3, speed: 70, life: 0.4, size: 3 });
        break;
      case 'dig-done':
        playSound(game.audio, 'digDone');
        burst(game.particles, cx, cy, { color: tileChipColor(event.tile), count: 14, speed: 130, life: 0.6, size: 4 });
        break;
      case 'gem': {
        const sound = event.tile === T.GEM_AMBER ? 'gemAmber' : event.tile === T.GEM_TEAL ? 'gemTeal' : 'gemViolet';
        playSound(game.audio, sound);
        burst(game.particles, cx, cy, { color: tileChipColor(event.tile), count: 16, speed: 100, life: 0.7, size: 4, gravity: 120 });
        floater(game.particles, cx, cy - 10, `+${event.value}`, tileChipColor(event.tile));
        break;
      }
      case 'bump':
        playSound(game.audio, 'bump');
        if (event.tile === T.HARD_ROCK) pushToast(game, 'Hard rock — upgrade your Drill at the tent.', PALETTE.amber);
        if (event.tile === T.LAVA) pushToast(game, 'Lava! It cannot be dug — go around.', '#ff8f6a');
        if (event.tile === T.BOULDER) pushToast(game, 'A boulder. A tier-3 Drill can crush it.', PALETTE.amber);
        break;
      case 'swing':
        playSound(game.audio, 'swing');
        break;
      case 'wisp-hit':
        playSound(game.audio, 'wispHit');
        burst(game.particles, cx, cy, { color: PALETTE.violet, count: 10, speed: 110, life: 0.5, size: 4, gravity: 60 });
        break;
      case 'wisp-die':
        playSound(game.audio, 'wispDie');
        burst(game.particles, cx, cy, { color: PALETTE.violet, count: 22, speed: 150, life: 0.8, size: 5, gravity: 80 });
        floater(game.particles, cx, cy - 10, `+${TUNING.wispScore}`, PALETTE.violet);
        if (game.rng() < TUNING.wispHeartChance) {
          cave.pickups.push({ x: event.x, y: event.y, kind: 'heart' });
        }
        break;
      case 'pickup':
        playSound(game.audio, 'pickup');
        if (event.kind === 'oxygen') {
          floater(game.particles, cx, cy - 10, `AIR +${TUNING.oxygenCanister}`, PALETTE.teal);
          burst(game.particles, cx, cy, { color: PALETTE.teal, count: 10, speed: 80, life: 0.5, size: 3, gravity: 40 });
        } else {
          floater(game.particles, cx, cy - 10, '+1 ♥', '#ff5d6c');
          burst(game.particles, cx, cy, { color: '#ff5d6c', count: 10, speed: 80, life: 0.5, size: 3, gravity: 40 });
        }
        break;
      case 'wisp-touch':
        if (applyDamage(player, 'wisp', events)) {
          banishWisp(event.wisp, cave, player, game.rng);
        }
        break;
      case 'hurt':
        playSound(game.audio, 'hurt');
        addShake(game.particles, 10);
        burst(game.particles, player.px, player.py, { color: '#ff5d6c', count: 14, speed: 130, life: 0.6, size: 4 });
        floater(game.particles, player.px, player.py - 24, '-1 ♥', '#ff5d6c');
        break;
      case 'boulder-land':
        if (onScreen(game, event.x, event.y)) {
          playSound(game.audio, 'boulder');
          burst(game.particles, cx, cy + 14, { color: '#6c6684', count: 10, speed: 90, life: 0.5, size: 4 });
        }
        break;
      case 'boulder-shatter':
        playSound(game.audio, 'boulder');
        addShake(game.particles, 8);
        burst(game.particles, cx, cy, { color: '#6c6684', count: 20, speed: 160, life: 0.7, size: 5 });
        break;
      case 'win':
        finishRun(game, true, 'The Heart Crystal is yours — the village will shine again.');
        break;
      case 'defeat':
        finishRun(game, false, event.reason);
        break;
      default:
        break;
    }
    if (game.state === 'victory' || game.state === 'defeat') {
      // A finished run stops answering the rest of this frame's events.
      if (event.type === 'win' || event.type === 'defeat') break;
    }
  }
}

function mouseActionFor(game) {
  const { input, camera, player } = game;
  if (!input.mouse.clickedAt) return null;
  const point = input.mouse.clickedAt;
  if (point.y < 54) return null; // the HUD bar is not the world
  const cellX = Math.floor((point.x + camera.x) / TILE);
  const cellY = Math.floor((point.y + camera.y) / TILE);
  const dx = cellX - player.gx;
  const dy = cellY - player.gy;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return null;
  const wispThere = game.wisps.some((w) => !w.dead && w.gx === cellX && w.gy === cellY);
  if (wispThere) return { kind: 'swing', dx, dy };
  const tile = tileAt(game.cave, cellX, cellY);
  if (isDiggable(tile, player.upgrades.drill)) return { kind: 'dig', dx, dy };
  if (isOpenTile(tile)) return { kind: 'step', dx, dy };
  return null;
}

function doAction(game, action) {
  switch (action.type) {
    case 'start':
      startRun(game);
      break;
    case 'resume':
      game.state = 'playing';
      break;
    case 'restart':
      startRun(game);
      break;
    case 'title':
      startTitleScene(game);
      break;
    case 'buy': {
      const result = buyUpgrade(game.player, action.id);
      if (result.ok) {
        playSound(game.audio, 'buy');
        const up = UPGRADES.find((u) => u.id === action.id);
        pushToast(game, `${up.name} upgraded!`, PALETTE.amber);
      } else {
        playSound(game.audio, 'deny');
        pushToast(game, result.reason, '#ff8f98');
      }
      break;
    }
    case 'rest': {
      const healed = restAtTent(game.player);
      playSound(game.audio, healed > 0 ? 'buy' : 'click');
      pushToast(game, healed > 0 ? `Rested. Hearts restored.` : 'Already at full hearts.', PALETTE.paper);
      break;
    }
    case 'leave':
      game.state = 'playing';
      break;
    default:
      break;
  }
}

function handleButtonClick(game) {
  const { input } = game;
  if (!input.mouse.clicked) return;
  const hit = uiButtonAt(game.buttons, input.mouse.x, input.mouse.y);
  if (hit) {
    playSound(game.audio, 'click');
    doAction(game, hit.action);
  }
}

function updateHint(game) {
  const { player } = game;
  if (player.gy <= SURFACE_ROW) {
    game.hint = player.gx >= 2 && player.gx <= 9
      ? 'E — Tent: shop, upgrades & rest  ·  the shaft leads down'
      : 'WASD / Arrows — move  ·  the tent (E) is to the left, the shaft leads down';
  } else if (player.oxygen < 25) {
    game.hint = 'LOW AIR — climb back to the surface, fast!';
  } else if (player.gy >= 58) {
    game.hint = 'The Heart Chamber is close — something glimmers below…';
  } else {
    game.hint = 'WASD dig & move · Space swing · click a next-door cell · E at the tent';
  }
}

function spawnAmbientDust(game) {
  const { camera, player } = game;
  if (player.gy <= SURFACE_ROW) return;
  const x = camera.x + game.rng() * VIEW_W;
  const y = camera.y + game.rng() * VIEW_H;
  burst(game.particles, x, y, { color: 'rgba(200,190,220,0.3)', count: 1, speed: 8, life: 2.4, size: 3, gravity: -10 });
}

export function update(game, dt) {
  const { input } = game;
  game.time += dt;
  game.stateTime += dt;
  if (input.pressed.size > 0 || input.mouse.clicked) ensureAudioContext(game.audio);
  if (wasPressed(input, 'mute')) {
    const muted = toggleAudioMuted(game.audio);
    pushToast(game, muted ? 'Sound off' : 'Sound on', PALETTE.paper);
  }
  for (let i = game.toasts.length - 1; i >= 0; i--) {
    game.toasts[i].life -= dt;
    if (game.toasts[i].life <= 0) game.toasts.splice(i, 1);
  }

  if (game.state === 'title') {
    game.camera.x = 160 + Math.sin(game.time * 0.07) * 140;
    game.camera.y = 0;
    updateParticles(game.particles, dt, null);
    if (wasPressed(input, 'confirm')) doAction(game, { type: 'start' });
    else handleButtonClick(game);
  } else if (game.state === 'playing') {
    if (wasPressed(input, 'pause')) {
      game.state = 'paused';
      game.stateTime = 0;
      playSound(game.audio, 'click');
    } else if (wasPressed(input, 'interact') && game.player.gy <= SURFACE_ROW && game.player.gx >= 2 && game.player.gx <= 9) {
      game.state = 'shop';
      game.stateTime = 0;
      playSound(game.audio, 'click');
    } else {
      game.runTime += dt;
      const events = [];
      const mouseAction = mouseActionFor(game);
      updatePlayer(game.player, game.cave, game.wisps, input, dt, events, mouseAction);
      updateWisps(game.wisps, game.cave, game.player, dt, game.rng, events);
      updateBoulders(game.cave, game.player, dt, events);
      maybeRespawnWisps(game.wisps, game.cave, game.player, game.rng, dt, game.respawnTimer);
      processEvents(game, events);
      if (game.state === 'playing') {
        updateCamera(game, dt);
        updateHint(game);
        if (game.player.oxygen < 25 && game.player.gy > SURFACE_ROW) {
          game.beepTimer -= dt;
          if (game.beepTimer <= 0) {
            game.beepTimer = 1;
            playSound(game.audio, 'beep');
          }
        }
      }
    }
    updateParticles(game.particles, dt, (p) => spawnAmbientDust(game, p));
  } else if (game.state === 'paused') {
    if (wasPressed(input, 'pause')) {
      game.state = 'playing';
    } else if (wasPressed(input, 'restart')) {
      doAction(game, { type: 'restart' });
    } else {
      handleButtonClick(game);
    }
  } else if (game.state === 'shop') {
    updateParticles(game.particles, dt, null);
    if (wasPressed(input, 'interact') || wasPressed(input, 'pause')) {
      game.state = 'playing';
    } else if (input.numberPressed !== null && input.numberPressed >= 1 && input.numberPressed <= UPGRADES.length) {
      doAction(game, { type: 'buy', id: UPGRADES[input.numberPressed - 1].id });
    } else {
      handleButtonClick(game);
    }
  } else if (game.state === 'victory' || game.state === 'defeat') {
    if (game.state === 'victory') {
      game.celebrateTimer -= dt;
      if (game.celebrateTimer <= 0) {
        game.celebrateTimer = 0.5;
        burst(game.particles, game.camera.x + game.rng() * VIEW_W, game.camera.y + game.rng() * VIEW_H * 0.5, {
          color: [PALETTE.amber, PALETTE.teal, PALETTE.violet, PALETTE.heart][Math.floor(game.rng() * 4)],
          count: 12, speed: 70, life: 1.4, size: 5, gravity: 50,
        });
      }
    }
    updateParticles(game.particles, dt, null);
    if (wasPressed(input, 'restart') || wasPressed(input, 'confirm')) doAction(game, { type: 'restart' });
    else if (wasPressed(input, 'title')) doAction(game, { type: 'title' });
    else handleButtonClick(game);
  }
  endFrameInput(input);
}

export function render(game) {
  const { ctx } = game;
  drawWorld(ctx, game);
  if (game.state === 'title') {
    drawTitle(ctx, game);
  } else if (game.state === 'playing') {
    drawHUD(ctx, game);
    drawToasts(ctx, game);
  } else if (game.state === 'paused') {
    drawHUD(ctx, game);
    drawPause(ctx, game);
  } else if (game.state === 'shop') {
    drawHUD(ctx, game);
    drawShopPanel(ctx, game);
  } else if (game.state === 'victory') {
    drawEndScreen(ctx, game, 'victory');
  } else if (game.state === 'defeat') {
    drawEndScreen(ctx, game, 'defeat');
  }
}
