// Glimmerdeep — the things that hunt in the dark. One job: gloom wisps, their
// drift toward the delver, their touch, and their slow return while the delver
// stays deep.

import { TILE, T, TUNING, bandAt } from './config.js';
import { tileAt, isOpenTile } from './cave.js';
import { randomPick, randomChance } from './rng.js';

export function spawnWisps(cave, rng, count) {
  const wisps = [];
  const spawns = [...cave.wispSpawns];
  for (let i = 0; i < count && spawns.length > 0; i++) {
    const at = spawns.splice(Math.floor(rng() * spawns.length), 1)[0];
    wisps.push(makeWisp(at.x, at.y, rng));
  }
  return wisps;
}

export function makeWisp(x, y, rng) {
  return {
    gx: x,
    gy: y,
    px: x * TILE + TILE / 2,
    py: y * TILE + TILE / 2,
    hp: TUNING.wispHp,
    stepTimer: rng ? rng() * 0.5 : 0,
    phase: rng ? rng() * Math.PI * 2 : 0,
    dead: false,
  };
}

function wispStepTime(depth) {
  return Math.max(0.3, TUNING.wispStepTime * (1 - depth * 0.004));
}

export function updateWisps(wisps, cave, player, dt, rng, events) {
  for (let i = wisps.length - 1; i >= 0; i--) {
    const wisp = wisps[i];
    if (wisp.dead) {
      wisps.splice(i, 1);
      continue;
    }
    wisp.stepTimer -= dt;
    if (wisp.stepTimer <= 0) {
      const dist = Math.abs(wisp.gx - player.gx) + Math.abs(wisp.gy - player.gy);
      const options = [];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = wisp.gx + dx;
        const ny = wisp.gy + dy;
        const tile = tileAt(cave, nx, ny);
        if (isOpenTile(tile) && tile !== T.HEART) options.push({ dx, dy, nx, ny });
      }
      if (options.length > 0) {
        let choice;
        if (dist <= TUNING.wispAggro) {
          let best = Infinity;
          const bestOptions = [];
          for (const opt of options) {
            const d = Math.abs(opt.nx - player.gx) + Math.abs(opt.ny - player.gy);
            if (d < best) {
              best = d;
              bestOptions.length = 0;
              bestOptions.push(opt);
            } else if (d === best) {
              bestOptions.push(opt);
            }
          }
          choice = randomPick(rng, bestOptions);
        } else if (randomChance(rng, 0.7)) {
          choice = randomPick(rng, options);
        }
        if (choice) {
          wisp.gx = choice.nx;
          wisp.gy = choice.ny;
        }
      }
      wisp.stepTimer = wispStepTime(Math.max(0, wisp.gy - 1));
    }
    const targetX = wisp.gx * TILE + TILE / 2;
    const targetY = wisp.gy * TILE + TILE / 2;
    const k = Math.min(1, dt * 9);
    wisp.px += (targetX - wisp.px) * k;
    wisp.py += (targetY - wisp.py) * k;
    if (wisp.gx === player.gx && wisp.gy === player.gy && player.invuln <= 0) {
      events.push({ type: 'wisp-touch', wisp });
    }
  }
}

// A wisp that struck the delver is flung back to a distant open cell.
export function banishWisp(wisp, cave, player, rng) {
  const far = cave.wispSpawns.filter(
    (s) => Math.abs(s.x - player.gx) + Math.abs(s.y - player.gy) > 8 && isOpenTile(tileAt(cave, s.x, s.y)),
  );
  const at = far.length > 0 ? randomPick(rng, far) : null;
  if (at) {
    wisp.gx = at.x;
    wisp.gy = at.y;
    wisp.px = at.x * TILE + TILE / 2;
    wisp.py = at.y * TILE + TILE / 2;
    wisp.stepTimer = 0.8;
  }
}

// While the delver stays deep, the dark sends more wisps, up to the band's cap.
export function maybeRespawnWisps(wisps, cave, player, rng, dt, timer) {
  timer.left -= dt;
  if (timer.left > 0) return;
  timer.left = TUNING.respawnTime;
  const cap = bandAt(player.gy).wispCap;
  if (player.gy <= 14 || wisps.length >= cap) return;
  const far = cave.wispSpawns.filter(
    (s) => Math.abs(s.x - player.gx) + Math.abs(s.y - player.gy) > 6 && isOpenTile(tileAt(cave, s.x, s.y)),
  );
  if (far.length > 0) {
    const at = randomPick(rng, far);
    wisps.push(makeWisp(at.x, at.y, rng));
  }
}
