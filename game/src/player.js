// Glimmerdeep — the delver. One job: Wren's movement, digging, pickaxe swing,
// oxygen and health. It mutates only the player and the cave, and reports
// everything worth hearing or seeing as events for the game to answer.

import { TILE, SURFACE_ROW, T, GEM_VALUES, TUNING } from './config.js';
import { tileAt, setTile, isOpenTile, isDiggable, digTimeFor, cellKey } from './cave.js';
import { inputDirection, wasPressed } from './input.js';

export function createPlayer(spawnX, spawnY) {
  return {
    gx: spawnX,
    gy: spawnY,
    px: spawnX * TILE + TILE / 2,
    py: spawnY * TILE + TILE / 2,
    facing: { dx: 0, dy: 1 },
    move: null,
    digging: null,
    mouseDig: null,
    swingTimer: 0,
    swingCooldown: 0,
    swingTarget: null,
    hearts: TUNING.heartsMax,
    maxHearts: TUNING.heartsMax,
    oxygen: TUNING.oxygenMax,
    maxOxygen: TUNING.oxygenMax,
    gems: 0,
    score: 0,
    gemsGathered: 0,
    maxDepth: 0,
    wispsFelled: 0,
    upgrades: { tank: 0, drill: 0, lantern: 0, boots: 0, plating: 0 },
    invuln: 0,
    bumpTimer: 0,
    digTickTimer: 0,
    walkPhase: 0,
    dead: false,
  };
}

export function moveDuration(player) {
  return Math.max(0.07, TUNING.moveTime - TUNING.bootsStep * player.upgrades.boots);
}

export function applyDamage(player, source, events) {
  if (player.invuln > 0 || player.dead) return false;
  player.hearts -= 1;
  player.invuln = TUNING.invulnTime;
  events.push({ type: 'hurt', source, x: player.gx, y: player.gy });
  if (player.hearts <= 0) {
    player.dead = true;
    events.push({ type: 'defeat', reason: 'Your lantern gutters out in the deep.' });
  }
  return true;
}

function startMove(player, tx, ty, events) {
  player.move = { fx: player.gx, fy: player.gy, tx, ty, t: 0, dur: moveDuration(player) };
  player.digging = null;
  player.mouseDig = null;
  player.walkPhase += 1;
  events.push({ type: 'step', x: tx, y: ty });
}

function attemptStep(player, cave, dx, dy, events) {
  const tx = player.gx + dx;
  const ty = player.gy + dy;
  player.facing = { dx, dy };
  const tile = tileAt(cave, tx, ty);
  if (isOpenTile(tile)) {
    startMove(player, tx, ty, events);
    return;
  }
  if (isDiggable(tile, player.upgrades.drill)) {
    player.digging = { x: tx, y: ty, total: digTimeFor(tile, player.upgrades.drill) };
    return;
  }
  if (player.bumpTimer <= 0) {
    player.bumpTimer = 0.3;
    events.push({ type: 'bump', x: tx, y: ty, tile });
  }
}

function finishMove(player, cave, events) {
  player.gx = player.move.tx;
  player.gy = player.move.ty;
  player.px = player.gx * TILE + TILE / 2;
  player.py = player.gy * TILE + TILE / 2;
  player.move = null;
  player.maxDepth = Math.max(player.maxDepth, player.gy - SURFACE_ROW);
  const pickupIndex = cave.pickups.findIndex((p) => p.x === player.gx && p.y === player.gy);
  if (pickupIndex >= 0) {
    const pickup = cave.pickups[pickupIndex];
    cave.pickups.splice(pickupIndex, 1);
    if (pickup.kind === 'oxygen') player.oxygen = Math.min(player.maxOxygen, player.oxygen + TUNING.oxygenCanister);
    if (pickup.kind === 'heart') player.hearts = Math.min(player.maxHearts, player.hearts + 1);
    events.push({ type: 'pickup', kind: pickup.kind, x: pickup.x, y: pickup.y });
  }
  if (tileAt(cave, player.gx, player.gy) === T.HEART) {
    events.push({ type: 'win' });
  }
}

function swingAt(player, wisps, tx, ty, events) {
  player.swingTimer = TUNING.swingTime;
  player.swingCooldown = TUNING.swingCooldown;
  player.swingTarget = { x: tx, y: ty };
  events.push({ type: 'swing', x: tx, y: ty });
  for (const wisp of wisps) {
    if (wisp.dead || wisp.gx !== tx || wisp.gy !== ty) continue;
    wisp.hp -= 1;
    if (wisp.hp <= 0) {
      wisp.dead = true;
      player.wispsFelled += 1;
      player.score += TUNING.wispScore;
      events.push({ type: 'wisp-die', x: tx, y: ty, wisp });
    } else {
      events.push({ type: 'wisp-hit', x: tx, y: ty, wisp });
    }
  }
}

// mouseAction: { kind: 'step'|'dig'|'swing', dx, dy } for a click on a cell
// next to the player, or null. Keyboard input wins over a stale mouse dig.
export function updatePlayer(player, cave, wisps, input, dt, events, mouseAction) {
  player.invuln = Math.max(0, player.invuln - dt);
  player.swingCooldown = Math.max(0, player.swingCooldown - dt);
  player.swingTimer = Math.max(0, player.swingTimer - dt);
  player.bumpTimer = Math.max(0, player.bumpTimer - dt);

  if (player.move) {
    const m = player.move;
    m.t += dt / m.dur;
    const k = Math.min(1, m.t);
    player.px = (m.fx * TILE + TILE / 2) * (1 - k) + (m.tx * TILE + TILE / 2) * k;
    player.py = (m.fy * TILE + TILE / 2) * (1 - k) + (m.ty * TILE + TILE / 2) * k;
    if (m.t >= 1) finishMove(player, cave, events);
  } else {
    const dir = inputDirection(input);
    if (mouseAction && mouseAction.kind === 'swing' && player.swingCooldown <= 0) {
      player.facing = { dx: mouseAction.dx, dy: mouseAction.dy };
      swingAt(player, wisps, player.gx + mouseAction.dx, player.gy + mouseAction.dy, events);
    } else if (wasPressed(input, 'swing') && player.swingCooldown <= 0) {
      swingAt(player, wisps, player.gx + player.facing.dx, player.gy + player.facing.dy, events);
    } else if (dir) {
      player.mouseDig = null;
      attemptStep(player, cave, dir.dx, dir.dy, events);
    } else if (mouseAction && mouseAction.kind === 'step') {
      attemptStep(player, cave, mouseAction.dx, mouseAction.dy, events);
    } else if (mouseAction && mouseAction.kind === 'dig') {
      const tx = player.gx + mouseAction.dx;
      const ty = player.gy + mouseAction.dy;
      player.facing = { dx: mouseAction.dx, dy: mouseAction.dy };
      const tile = tileAt(cave, tx, ty);
      if (isDiggable(tile, player.upgrades.drill)) {
        player.mouseDig = { x: tx, y: ty };
        player.digging = { x: tx, y: ty, total: digTimeFor(tile, player.upgrades.drill) };
      }
    }
    // Keep digging while the key still points at the same cell, or the mouse
    // dig is still aimed there; otherwise stop (progress stays on the cell).
    if (player.digging && !player.move) {
      const d = player.digging;
      const stillHeld = dir && player.gx + dir.dx === d.x && player.gy + dir.dy === d.y;
      const stillMouse = player.mouseDig && player.mouseDig.x === d.x && player.mouseDig.y === d.y;
      if (!stillHeld && !stillMouse) player.digging = null;
    }
  }

  if (player.digging && !player.move) {
    const d = player.digging;
    const key = cellKey(d.x, d.y);
    const tile = tileAt(cave, d.x, d.y);
    if (!isDiggable(tile, player.upgrades.drill)) {
      player.digging = null;
      cave.digWear.delete(key);
    } else {
      const progress = (cave.digWear.get(key) || 0) + dt;
      cave.digWear.set(key, progress);
      player.digTickTimer -= dt;
      if (player.digTickTimer <= 0) {
        player.digTickTimer = 0.15;
        events.push({ type: 'dig-tick', x: d.x, y: d.y, tile });
      }
      if (progress >= d.total) {
        cave.digWear.delete(key);
        setTile(cave, d.x, d.y, T.AIR);
        player.digging = null;
        player.mouseDig = null;
        events.push({ type: 'dig-done', x: d.x, y: d.y, tile });
        const value = GEM_VALUES[tile];
        if (value) {
          player.gems += value;
          player.score += value;
          player.gemsGathered += value;
          events.push({ type: 'gem', x: d.x, y: d.y, tile, value });
        }
      }
    }
  }

  // Oxygen: drains underground, faster the deeper you go; the surface refills.
  if (player.gy > SURFACE_ROW) {
    const depth = player.gy - SURFACE_ROW;
    player.oxygen -= TUNING.oxygenDrain * (1 + TUNING.oxygenDepthScale * depth) * dt;
    if (player.oxygen <= 0) {
      player.oxygen = 0;
      player.dead = true;
      events.push({ type: 'defeat', reason: 'The dark closed in — out of air.' });
    }
  } else {
    player.oxygen = Math.min(player.maxOxygen, player.oxygen + TUNING.oxygenRefill * dt);
  }
}
