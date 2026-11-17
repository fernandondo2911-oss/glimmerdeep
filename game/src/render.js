// Glimmerdeep — drawing the world. One job: turn the cave, the delver, the
// wisps and the light into one picture: pre-rendered tile sprites, surface
// props, lantern lighting punched through darkness, and additive glows.

import { VIEW_W, VIEW_H, TILE, COLS, ROWS, SHAFT_COL, T, PALETTE, TUNING, bandAt } from './config.js';
import { tileAt, cellKey, isOpenTile } from './cave.js';
import { hash2, mulberry32 } from './rng.js';
import { drawParticles, shakeOffset } from './particles.js';

let sprites = null;
let lightCanvas = null;
let lightCtx = null;

function makeSprite(draw) {
  const canvas = document.createElement('canvas');
  canvas.width = TILE;
  canvas.height = TILE;
  draw(canvas.getContext('2d'));
  return canvas;
}

function speckle(ctx, rng, count, colors, sizeMax) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
    const s = 1 + Math.floor(rng() * sizeMax);
    ctx.fillRect(Math.floor(rng() * TILE), Math.floor(rng() * TILE), s, s);
  }
}

function buildSprites() {
  const rng = mulberry32(12345);
  const dirt = [];
  const rock = [];
  const hard = [];
  for (let v = 0; v < 3; v++) {
    dirt.push(makeSprite((ctx) => {
      ctx.fillStyle = PALETTE.dirt;
      ctx.fillRect(0, 0, TILE, TILE);
      speckle(ctx, rng, 26, [PALETTE.dirtDark, '#7a5638', '#5d3f27'], 3);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, TILE - 3, TILE, 3);
      ctx.fillRect(TILE - 3, 0, 3, TILE);
    }));
    rock.push(makeSprite((ctx) => {
      ctx.fillStyle = PALETTE.rock;
      ctx.fillRect(0, 0, TILE, TILE);
      speckle(ctx, rng, 22, [PALETTE.rockDark, '#575170', '#413c56'], 3);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(6 + rng() * 8, 4);
      ctx.lineTo(14 + rng() * 10, 20);
      ctx.lineTo(10 + rng() * 8, 34);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(0, 0, TILE, 2);
    }));
    hard.push(makeSprite((ctx) => {
      ctx.fillStyle = PALETTE.hardRock;
      ctx.fillRect(0, 0, TILE, TILE);
      speckle(ctx, rng, 18, ['#2a2740', '#3e3a58', '#282538'], 3);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(4, 10 + rng() * 6);
      ctx.lineTo(20, 16 + rng() * 6);
      ctx.lineTo(36, 8 + rng() * 6);
      ctx.moveTo(12, 30);
      ctx.lineTo(24, 26);
      ctx.lineTo(34, 33);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(0, 0, TILE, 2);
    }));
  }
  const bedrock = makeSprite((ctx) => {
    ctx.fillStyle = PALETTE.bedrock;
    ctx.fillRect(0, 0, TILE, TILE);
    speckle(ctx, rng, 14, ['#141226', '#241f3a'], 3);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, 0, TILE, 2);
  });
  const grass = makeSprite((ctx) => {
    ctx.fillStyle = PALETTE.dirt;
    ctx.fillRect(0, 0, TILE, TILE);
    speckle(ctx, rng, 16, [PALETTE.dirtDark, '#7a5638'], 3);
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, TILE, 13);
    ctx.fillStyle = PALETTE.grassDark;
    for (let x = 2; x < TILE; x += 5) {
      ctx.fillRect(x, 9 + Math.floor(rng() * 3), 2, 4);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, 0, TILE, 2);
  });
  const boulder = makeSprite((ctx) => {
    ctx.fillStyle = '#5a5470';
    ctx.beginPath();
    ctx.arc(20, 21, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6c6684';
    ctx.beginPath();
    ctx.arc(16, 16, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(24, 26, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.arc(14, 13, 4, 0, Math.PI * 2);
    ctx.fill();
  });
  sprites = { dirt, rock, hard, bedrock, grass, boulder };
}

function openCellBackground(ctx, sx, sy, x, y, seed) {
  const h = hash2(x, y, seed);
  ctx.fillStyle = h > 0.5 ? '#191530' : '#151128';
  ctx.fillRect(sx, sy, TILE, TILE);
  if (h > 0.72) {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(sx + 6 + h * 20, sy + 8 + h * 16, 3, 3);
  }
  if (h < 0.2) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(sx + 4 + h * 60, sy + 26, 5, 3);
  }
}

function drawGem(ctx, sx, sy, tile, time, x, y) {
  const color = tile === T.GEM_AMBER ? PALETTE.amber : tile === T.GEM_TEAL ? PALETTE.teal : PALETTE.violet;
  const pulse = 0.75 + 0.25 * Math.sin(time * 2.4 + x * 1.3 + y);
  const cx = sx + TILE / 2;
  const cy = sy + TILE / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = color;
  const r = 9;
  ctx.fillRect(-r / 1.4, -r / 1.4, r * 1.4, r * 1.4);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(-r / 1.4, -r / 1.4, r * 0.7, r * 0.7);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawLava(ctx, sx, sy, time, x, y) {
  ctx.fillStyle = '#571a0c';
  ctx.fillRect(sx, sy, TILE, TILE);
  const wobble = Math.sin(time * 3 + x * 2 + y) * 2;
  ctx.fillStyle = PALETTE.lava;
  ctx.beginPath();
  ctx.arc(sx + 20 + wobble, sy + 20, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.lavaCore;
  ctx.beginPath();
  ctx.arc(sx + 20 - wobble, sy + 20, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,210,58,0.5)';
  ctx.fillRect(sx + 6, sy + 4 + wobble * 0.5, 5, 3);
  ctx.fillRect(sx + 28, sy + 30 - wobble * 0.5, 4, 3);
}

function drawHeartCrystal(ctx, sx, sy, time) {
  const cx = sx + TILE / 2;
  const cy = sy + TILE / 2 + 4;
  const pulse = 1 + 0.08 * Math.sin(time * 2);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = PALETTE.heart;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(11, -4);
  ctx.lineTo(6, 16);
  ctx.lineTo(-6, 16);
  ctx.lineTo(-11, -4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ff8fab';
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(5, -4);
  ctx.lineTo(2, 16);
  ctx.lineTo(-2, 16);
  ctx.lineTo(-5, -4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(3, -4);
  ctx.lineTo(0, 10);
  ctx.lineTo(-3, -4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  for (let i = 0; i < 3; i++) {
    const a = time * 0.9 + (i * Math.PI * 2) / 3;
    ctx.fillStyle = 'rgba(255,93,143,0.8)';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * 24, cy - 4 + Math.sin(a) * 12, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSky(ctx, camera, time) {
  const top = -camera.y;
  if (top > VIEW_H) return;
  const grad = ctx.createLinearGradient(0, top, 0, top + 130);
  grad.addColorStop(0, PALETTE.skyTop);
  grad.addColorStop(0.55, PALETTE.skyMid);
  grad.addColorStop(1, PALETTE.skyLow);
  ctx.fillStyle = grad;
  ctx.fillRect(0, top, VIEW_W, 130);
  // Low sun and drifting dusk clouds.
  ctx.fillStyle = '#ffd98a';
  ctx.beginPath();
  ctx.arc(VIEW_W - 220, top + 58, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,217,138,0.25)';
  ctx.beginPath();
  ctx.arc(VIEW_W - 220, top + 58, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(43,30,79,0.55)';
  for (let i = 0; i < 4; i++) {
    const cx = ((i * 340 + time * 6) % (VIEW_W + 240)) - 120;
    ctx.beginPath();
    ctx.ellipse(cx, top + 26 + (i % 2) * 22, 70, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Hills on the horizon.
  ctx.fillStyle = PALETTE.hillFar;
  ctx.beginPath();
  ctx.moveTo(0, top + 130);
  for (let x = 0; x <= VIEW_W; x += 80) ctx.lineTo(x, top + 96 + 18 * Math.sin(x * 0.006 + 1));
  ctx.lineTo(VIEW_W, top + 130);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.hillNear;
  ctx.beginPath();
  ctx.moveTo(0, top + 130);
  for (let x = 0; x <= VIEW_W; x += 80) ctx.lineTo(x, top + 112 + 14 * Math.sin(x * 0.009 + 4));
  ctx.lineTo(VIEW_W, top + 130);
  ctx.closePath();
  ctx.fill();
}

function drawSurfaceProps(ctx, camera, time) {
  const gy = 1;
  const baseY = gy * TILE - camera.y + TILE;
  const tentX = 4 * TILE - camera.x;
  // The tent: striped canvas, pole, rug, and its SHOP sign.
  ctx.fillStyle = '#8a4b2a';
  ctx.fillRect(tentX + 18, baseY - 64, 5, 64);
  ctx.fillStyle = '#d9c9a8';
  ctx.beginPath();
  ctx.moveTo(tentX - 6, baseY);
  ctx.lineTo(tentX + 58, baseY - 78);
  ctx.lineTo(tentX + 122, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#b8483f';
  ctx.beginPath();
  ctx.moveTo(tentX + 26, baseY);
  ctx.lineTo(tentX + 58, baseY - 78);
  ctx.lineTo(tentX + 74, baseY - 46);
  ctx.lineTo(tentX + 58, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(tentX + 90, baseY);
  ctx.lineTo(tentX + 58, baseY - 78);
  ctx.lineTo(tentX + 74, baseY - 46);
  ctx.lineTo(tentX + 106, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5d3a22';
  ctx.beginPath();
  ctx.moveTo(tentX + 44, baseY);
  ctx.lineTo(tentX + 58, baseY - 34);
  ctx.lineTo(tentX + 72, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.wood;
  ctx.fillRect(tentX + 118, baseY - 40, 5, 40);
  ctx.fillStyle = '#c9a86a';
  ctx.fillRect(tentX + 104, baseY - 58, 52, 20);
  ctx.strokeStyle = PALETTE.woodDark;
  ctx.strokeRect(tentX + 104, baseY - 58, 52, 20);
  ctx.fillStyle = '#3a2413';
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SHOP', tentX + 130, baseY - 48);
  // Signpost by the shaft.
  const signX = 12 * TILE - camera.x;
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(signX + 8, baseY - 44, 5, 44);
  ctx.fillStyle = '#c9a86a';
  ctx.beginPath();
  ctx.moveTo(signX - 16, baseY - 62);
  ctx.lineTo(signX + 34, baseY - 62);
  ctx.lineTo(signX + 42, baseY - 51);
  ctx.lineTo(signX + 34, baseY - 40);
  ctx.lineTo(signX - 16, baseY - 40);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3a2413';
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.fillText('MINE ↓', signX + 12, baseY - 51);
  // Lantern post: warm light on the surface.
  const lampX = 18 * TILE - camera.x;
  ctx.fillStyle = '#2c2438';
  ctx.fillRect(lampX + 8, baseY - 58, 5, 58);
  ctx.fillStyle = '#2c2438';
  ctx.fillRect(lampX + 8, baseY - 58, 20, 5);
  const flicker = 0.85 + 0.15 * Math.sin(time * 7 + 1);
  ctx.fillStyle = '#ffd98a';
  ctx.globalAlpha = flicker;
  ctx.beginPath();
  ctx.arc(lampX + 28, baseY - 48, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // Mine entrance frame around the shaft.
  const shaftX = SHAFT_COL * TILE - camera.x;
  ctx.fillStyle = PALETTE.woodDark;
  ctx.fillRect(shaftX - 10, baseY - 72, 10, 72);
  ctx.fillRect(shaftX + TILE, baseY - 72, 10, 72);
  ctx.fillStyle = PALETTE.wood;
  ctx.fillRect(shaftX - 14, baseY - 80, TILE + 28, 10);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(shaftX - 14, baseY - 80, TILE + 28, 3);
  // Crates and a barrel near the tent.
  ctx.fillStyle = PALETTE.wood;
  ctx.fillRect(9 * TILE - camera.x, baseY - 26, 26, 26);
  ctx.strokeStyle = PALETTE.woodDark;
  ctx.strokeRect(9 * TILE - camera.x, baseY - 26, 26, 26);
  ctx.fillStyle = '#7a5230';
  ctx.beginPath();
  ctx.ellipse(31 * TILE - camera.x, baseY - 14, 13, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(31 * TILE - camera.x - 13, baseY - 18, 26, 3);
}

function drawPickup(ctx, pickup, camera, time) {
  const sx = pickup.x * TILE + TILE / 2 - camera.x;
  const sy = pickup.y * TILE + TILE / 2 - camera.y;
  const bob = Math.sin(time * 2.6 + pickup.x) * 3;
  if (pickup.kind === 'oxygen') {
    ctx.fillStyle = '#2b6f6a';
    ctx.fillRect(sx - 8, sy - 10 + bob, 16, 22);
    ctx.fillStyle = PALETTE.teal;
    ctx.fillRect(sx - 8, sy - 10 + bob, 16, 7);
    ctx.fillStyle = '#d8d8e0';
    ctx.fillRect(sx - 3, sy - 15 + bob, 6, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(sx - 5, sy - 6 + bob, 3, 12);
  } else {
    const pulse = 1 + 0.12 * Math.sin(time * 4 + pickup.y);
    ctx.save();
    ctx.translate(sx, sy + bob);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#ff5d6c';
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.bezierCurveTo(-14, -2, -9, -12, 0, -5);
    ctx.bezierCurveTo(9, -12, 14, -2, 0, 10);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(-4, -4, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawWisp(ctx, wisp, camera, time) {
  const sx = wisp.px - camera.x;
  const sy = wisp.py - camera.y + Math.sin(time * 3 + wisp.phase) * 3;
  const glow = ctx.createRadialGradient(sx, sy, 2, sx, sy, 26);
  glow.addColorStop(0, 'rgba(182,120,255,0.55)');
  glow.addColorStop(1, 'rgba(182,120,255,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(sx, sy, 26, 0, Math.PI * 2);
  ctx.fill();
  const sway = Math.sin(time * 5 + wisp.phase) * 3;
  ctx.fillStyle = '#c9a8ff';
  ctx.beginPath();
  ctx.moveTo(sx, sy - 16);
  ctx.quadraticCurveTo(sx + 11, sy - 4, sx + 8 + sway, sy + 10);
  ctx.quadraticCurveTo(sx + 3, sy + 5, sx, sy + 11);
  ctx.quadraticCurveTo(sx - 3, sy + 5, sx - 8 + sway, sy + 10);
  ctx.quadraticCurveTo(sx - 11, sy - 4, sx, sy - 16);
  ctx.fill();
  ctx.fillStyle = '#f2e9ff';
  ctx.beginPath();
  ctx.arc(sx, sy - 4, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#241a3a';
  ctx.beginPath();
  ctx.arc(sx - 3.5, sy - 5, 1.6, 0, Math.PI * 2);
  ctx.arc(sx + 3.5, sy - 5, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer(ctx, player, camera, time) {
  if (player.invuln > 0 && Math.floor(time * 12) % 2 === 0) return; // hurt blink
  const sx = player.px - camera.x;
  const bob = player.move ? Math.abs(Math.sin(player.walkPhase * Math.PI)) * -2 : Math.sin(time * 2) * 0.8;
  const sy = player.py - camera.y + bob;
  const flip = player.facing.dx < 0 ? -1 : 1;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(flip, 1);
  // Boots and legs.
  ctx.fillStyle = '#3a2c22';
  ctx.fillRect(-9, 10, 7, 8);
  ctx.fillRect(2, 10, 7, 8);
  // Jacket.
  ctx.fillStyle = '#2e7d6b';
  ctx.beginPath();
  ctx.roundRect(-11, -4, 22, 16, 5);
  ctx.fill();
  ctx.fillStyle = '#35917c';
  ctx.fillRect(-11, -4, 22, 5);
  // Belt and satchel.
  ctx.fillStyle = '#6e4525';
  ctx.fillRect(-11, 6, 22, 3);
  ctx.fillStyle = '#8a5a33';
  ctx.fillRect(-14, 2, 6, 8);
  // Head.
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(0, -11, 9, 0, Math.PI * 2);
  ctx.fill();
  // Helmet and lamp.
  ctx.fillStyle = '#e8a91f';
  ctx.beginPath();
  ctx.arc(0, -13, 9.5, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-11, -14, 22, 3);
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(5, -15, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // Eye.
  ctx.fillStyle = '#241a20';
  ctx.beginPath();
  ctx.arc(4, -10, 1.6, 0, Math.PI * 2);
  ctx.fill();
  // Pickaxe arm: swings while digging or striking.
  let armAngle = -0.3;
  if (player.digging) armAngle = -0.9 + 0.7 * Math.sin(time * 16);
  else if (player.swingTimer > 0) armAngle = -1.5 + (1 - player.swingTimer / TUNING.swingTime) * 2.2;
  ctx.save();
  ctx.translate(8, 0);
  ctx.rotate(armAngle);
  ctx.strokeStyle = '#8a5a33';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(14, 0);
  ctx.stroke();
  ctx.strokeStyle = '#9aa3b0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(14, -6);
  ctx.quadraticCurveTo(20, 0, 14, 7);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function punchLight(ctx, x, y, radius, strength) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, `rgba(0,0,0,${strength})`);
  grad.addColorStop(0.6, `rgba(0,0,0,${strength * 0.55})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawLighting(ctx, game, camera) {
  if (!lightCanvas) {
    lightCanvas = document.createElement('canvas');
    lightCanvas.width = VIEW_W;
    lightCanvas.height = VIEW_H;
    lightCtx = lightCanvas.getContext('2d');
  }
  const { cave, player, time } = game;
  const darkness = player.gy <= 1 ? 0.1 : bandAt(player.gy).darkness;
  lightCtx.globalCompositeOperation = 'source-over';
  lightCtx.clearRect(0, 0, VIEW_W, VIEW_H);
  lightCtx.fillStyle = `rgba(6, 5, 16, ${darkness})`;
  lightCtx.fillRect(0, 0, VIEW_W, VIEW_H);
  lightCtx.globalCompositeOperation = 'destination-out';
  const flicker = 1 + 0.04 * Math.sin(time * 9) + 0.03 * Math.sin(time * 23);
  const radius = (TUNING.lanternRadius + TUNING.lanternStep * player.upgrades.lantern) * flicker;
  punchLight(lightCtx, player.px - camera.x, player.py - camera.y, radius, 1);
  const x0 = Math.max(0, Math.floor(camera.x / TILE));
  const x1 = Math.min(COLS - 1, Math.ceil((camera.x + VIEW_W) / TILE));
  const y0 = Math.max(0, Math.floor(camera.y / TILE));
  const y1 = Math.min(ROWS - 1, Math.ceil((camera.y + VIEW_H) / TILE));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const tile = tileAt(cave, x, y);
      if (tile === T.LAVA) punchLight(lightCtx, x * TILE + TILE / 2 - camera.x, y * TILE + TILE / 2 - camera.y, 78, 0.85);
      else if (tile === T.HEART) punchLight(lightCtx, x * TILE + TILE / 2 - camera.x, y * TILE + TILE / 2 - camera.y, 150, 0.95);
      else if (tile === T.GEM_AMBER || tile === T.GEM_TEAL || tile === T.GEM_VIOLET) {
        punchLight(lightCtx, x * TILE + TILE / 2 - camera.x, y * TILE + TILE / 2 - camera.y, 46, 0.4);
      }
    }
  }
  for (const pickup of cave.pickups) {
    punchLight(lightCtx, pickup.x * TILE + TILE / 2 - camera.x, pickup.y * TILE + TILE / 2 - camera.y, 42, 0.4);
  }
  for (const wisp of game.wisps) {
    punchLight(lightCtx, wisp.px - camera.x, wisp.py - camera.y, 52, 0.5);
  }
  ctx.drawImage(lightCanvas, 0, 0);
}

function drawGlows(ctx, game, camera) {
  const { cave, player, time } = game;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const lantern = ctx.createRadialGradient(
    player.px - camera.x, player.py - camera.y, 4,
    player.px - camera.x, player.py - camera.y, 90,
  );
  lantern.addColorStop(0, 'rgba(255,217,138,0.28)');
  lantern.addColorStop(1, 'rgba(255,217,138,0)');
  ctx.fillStyle = lantern;
  ctx.beginPath();
  ctx.arc(player.px - camera.x, player.py - camera.y, 90, 0, Math.PI * 2);
  ctx.fill();
  const x0 = Math.max(0, Math.floor(camera.x / TILE));
  const x1 = Math.min(COLS - 1, Math.ceil((camera.x + VIEW_W) / TILE));
  const y0 = Math.max(0, Math.floor(camera.y / TILE));
  const y1 = Math.min(ROWS - 1, Math.ceil((camera.y + VIEW_H) / TILE));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const tile = tileAt(cave, x, y);
      const cx = x * TILE + TILE / 2 - camera.x;
      const cy = y * TILE + TILE / 2 - camera.y;
      const pulse = 0.16 + 0.06 * Math.sin(time * 2.4 + x + y);
      let color = null;
      let r = 0;
      if (tile === T.LAVA) { color = '255,106,42'; r = 46; }
      else if (tile === T.GEM_AMBER) { color = '255,180,58'; r = 30; }
      else if (tile === T.GEM_TEAL) { color = '57,214,192'; r = 30; }
      else if (tile === T.GEM_VIOLET) { color = '182,120,255'; r = 30; }
      else if (tile === T.HEART) { color = '255,93,143'; r = 80; }
      if (!color) continue;
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, r);
      grad.addColorStop(0, `rgba(${color},${tile === T.HEART ? 0.4 : pulse})`);
      grad.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawDigProgress(ctx, game, camera) {
  const { player, cave } = game;
  if (!player.digging) return;
  const d = player.digging;
  const progress = (cave.digWear.get(cellKey(d.x, d.y)) || 0) / d.total;
  const sx = d.x * TILE - camera.x;
  const sy = d.y * TILE - camera.y;
  ctx.strokeStyle = 'rgba(245,238,218,0.85)';
  ctx.lineWidth = 3;
  ctx.strokeRect(sx + 2, sy + 2, TILE - 4, TILE - 4);
  const cracks = Math.floor(progress * 4);
  ctx.strokeStyle = 'rgba(20,16,31,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < cracks; i++) {
    const ax = sx + 8 + i * 8;
    ctx.moveTo(ax, sy + 6);
    ctx.lineTo(ax + 5, sy + 20);
    ctx.lineTo(ax - 2, sy + 34);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(12,9,24,0.8)';
  ctx.fillRect(sx + 4, sy - 10, TILE - 8, 6);
  ctx.fillStyle = PALETTE.amber;
  ctx.fillRect(sx + 4, sy - 10, (TILE - 8) * Math.min(1, progress), 6);
}

export function drawWorld(ctx, game) {
  if (!sprites) buildSprites();
  const { cave, player, time, camera } = game;
  const shake = shakeOffset(game.particles);
  const cam = { x: camera.x + shake.x, y: camera.y + shake.y };
  ctx.fillStyle = '#0f0d1d';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawSky(ctx, cam, time);
  const x0 = Math.max(0, Math.floor(cam.x / TILE));
  const x1 = Math.min(COLS - 1, Math.ceil((cam.x + VIEW_W) / TILE));
  const y0 = Math.max(0, Math.floor(cam.y / TILE));
  const y1 = Math.min(ROWS - 1, Math.ceil((cam.y + VIEW_H) / TILE));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const tile = tileAt(cave, x, y);
      const sx = x * TILE - cam.x;
      const sy = y * TILE - cam.y;
      const variant = Math.floor(hash2(x, y, cave.seed) * 3);
      if (tile === T.AIR) {
        // Row 0 is open sky (the sky gradient shows through); deeper open
        // cells get the cave background.
        if (y > 0) openCellBackground(ctx, sx, sy, x, y, cave.seed);
      } else if (tile === T.GRASS) {
        ctx.drawImage(sprites.grass, sx, sy);
      } else if (tile === T.DIRT) {
        ctx.drawImage(sprites.dirt[variant], sx, sy);
      } else if (tile === T.ROCK) {
        ctx.drawImage(sprites.rock[variant], sx, sy);
      } else if (tile === T.HARD_ROCK) {
        ctx.drawImage(sprites.hard[variant], sx, sy);
      } else if (tile === T.BEDROCK) {
        ctx.drawImage(sprites.bedrock, sx, sy);
      } else if (tile === T.BOULDER) {
        openCellBackground(ctx, sx, sy, x, y, cave.seed);
        const wobbling = cave.boulderWobble.has(cellKey(x, y));
        const wobble = wobbling ? Math.sin(time * 30) * 1.6 : 0;
        ctx.drawImage(sprites.boulder, sx + wobble, sy);
      } else if (tile === T.LAVA) {
        drawLava(ctx, sx, sy, time, x, y);
      } else if (tile === T.GEM_AMBER || tile === T.GEM_TEAL || tile === T.GEM_VIOLET) {
        ctx.drawImage(sprites.rock[variant], sx, sy);
        drawGem(ctx, sx, sy, tile, time, x, y);
      } else if (tile === T.HEART) {
        openCellBackground(ctx, sx, sy, x, y, cave.seed);
        drawHeartCrystal(ctx, sx, sy, time);
      }
    }
  }
  if (cam.y < 2 * TILE) drawSurfaceProps(ctx, cam, time);
  for (const pickup of cave.pickups) {
    if (pickup.x < x0 || pickup.x > x1 || pickup.y < y0 || pickup.y > y1) continue;
    drawPickup(ctx, pickup, cam, time);
  }
  for (const wisp of game.wisps) {
    drawWisp(ctx, wisp, cam, time);
  }
  drawPlayer(ctx, player, cam, time);
  drawLighting(ctx, game, cam);
  drawGlows(ctx, game, cam);
  drawParticles(ctx, cam, game.particles);
  drawDigProgress(ctx, game, cam);
  // Soft vignette so the frame reads at a glance.
  const vignette = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}
