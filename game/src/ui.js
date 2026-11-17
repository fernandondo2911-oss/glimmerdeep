// Glimmerdeep — screens and HUD. One job: everything drawn on top of the
// world: the HUD, the title, pause, shop and end screens, buttons and toasts.
// Buttons are plain data; the game reads clicks against the list each frame.

import { VIEW_W, VIEW_H, PALETTE, TUNING, bandAt, SURFACE_ROW } from './config.js';
import { UPGRADES, upgradeLevel, upgradeCost } from './shop.js';

export function drawText(ctx, str, x, y, { size = 18, color = PALETTE.paper, align = 'left', baseline = 'alphabetic', weight = 400, font = 'system-ui, sans-serif', glow = null } = {}) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 14;
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}

export function drawPanel(ctx, x, y, w, h, { fill = 'rgba(16, 12, 30, 0.92)', line = PALETTE.hudLine, radius = 14 } = {}) {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export function makeButton(x, y, w, h, label, action, { sub = '', disabled = false, primary = false } = {}) {
  return { x, y, w, h, label, action, sub, disabled, primary };
}

export function buttonAt(buttons, mx, my) {
  for (const b of buttons) {
    if (!b.disabled && mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) return b;
  }
  return null;
}

export function drawButtons(ctx, buttons, mouse, time) {
  for (const b of buttons) {
    const hover = !b.disabled && mouse.x >= b.x && mouse.x <= b.x + b.w && mouse.y >= b.y && mouse.y <= b.y + b.h;
    const pulse = b.primary ? 0.5 + 0.5 * Math.sin(time * 3) : 0;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 10);
    if (b.disabled) ctx.fillStyle = 'rgba(60, 55, 80, 0.85)';
    else if (b.primary) ctx.fillStyle = hover ? '#ffcf5e' : '#f5b83a';
    else ctx.fillStyle = hover ? '#4a4266' : 'rgba(38, 33, 58, 0.95)';
    ctx.fill();
    ctx.strokeStyle = b.primary ? '#fff3c4' : PALETTE.hudLine;
    ctx.lineWidth = b.primary ? 2 + pulse : 1.5;
    ctx.stroke();
    const labelColor = b.disabled ? '#8a86a0' : b.primary ? '#241a10' : PALETTE.paper;
    drawText(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 + (b.sub ? -6 : 0), {
      size: b.primary ? 24 : 19, weight: 700, color: labelColor, align: 'center', baseline: 'middle',
    });
    if (b.sub) {
      drawText(ctx, b.sub, b.x + b.w / 2, b.y + b.h / 2 + 16, {
        size: 12, color: b.disabled ? '#6f6a85' : b.primary ? '#5a4318' : '#b9b3cc', align: 'center', baseline: 'middle',
      });
    }
    ctx.restore();
  }
}

function drawHeartShape(ctx, cx, cy, size, fill) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(size / 20, size / 20);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.bezierCurveTo(-12, -2, -8, -10, 0, -4);
  ctx.bezierCurveTo(8, -10, 12, -2, 0, 8);
  ctx.fill();
  ctx.restore();
}

function drawGemShape(ctx, cx, cy, size, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = color;
  const r = size / 2;
  ctx.fillRect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(-r * 0.7, -r * 0.7, r * 0.7, r * 0.7);
  ctx.restore();
}

export function drawUpgradeIcon(ctx, id, cx, cy, size) {
  ctx.save();
  ctx.translate(cx, cy);
  const s = size / 28;
  ctx.scale(s, s);
  if (id === 'tank') {
    ctx.fillStyle = '#2b6f6a';
    ctx.beginPath();
    ctx.roundRect(-8, -10, 16, 22, 5);
    ctx.fill();
    ctx.fillStyle = PALETTE.teal;
    ctx.fillRect(-8, -10, 16, 7);
    ctx.fillStyle = '#d8d8e0';
    ctx.fillRect(-3, -14, 6, 4);
  } else if (id === 'drill') {
    ctx.strokeStyle = '#8a5a33';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-8, 10);
    ctx.lineTo(8, -8);
    ctx.stroke();
    ctx.strokeStyle = '#c8ccd8';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(2, -12);
    ctx.quadraticCurveTo(14, -8, 12, 2);
    ctx.stroke();
  } else if (id === 'lantern') {
    ctx.strokeStyle = '#c9a86a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -6, 6, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#ffd98a';
    ctx.beginPath();
    ctx.roundRect(-8, -6, 16, 18, 4);
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(0, 3, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2c22';
    ctx.fillRect(-8, 10, 16, 3);
  } else if (id === 'boots') {
    ctx.fillStyle = '#b8483f';
    ctx.beginPath();
    ctx.moveTo(-9, -11);
    ctx.lineTo(1, -11);
    ctx.lineTo(1, 2);
    ctx.lineTo(10, 2);
    ctx.lineTo(10, 10);
    ctx.lineTo(-9, 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7e322c';
    ctx.fillRect(-9, 7, 19, 3);
  } else if (id === 'plating') {
    ctx.fillStyle = '#7f89a3';
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(10, -7);
    ctx.lineTo(10, 2);
    ctx.quadraticCurveTo(10, 9, 0, 13);
    ctx.quadraticCurveTo(-10, 9, -10, 2);
    ctx.lineTo(-10, -7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#aab4cc';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, -5);
    ctx.lineTo(6, 2);
    ctx.quadraticCurveTo(6, 6, 0, 9);
    ctx.quadraticCurveTo(-6, 6, -6, 2);
    ctx.lineTo(-6, -5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function drawHUD(ctx, game) {
  const { player, time } = game;
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(0, 0, VIEW_W, 54);
  ctx.fillStyle = PALETTE.hudLine;
  ctx.fillRect(0, 54, VIEW_W, 1);
  // Hearts.
  for (let i = 0; i < player.maxHearts; i++) {
    drawHeartShape(ctx, 26 + i * 26, 27, 20, i < player.hearts ? '#ff5d6c' : 'rgba(120,116,140,0.5)');
  }
  // Air bar.
  const airX = 26 + player.maxHearts * 26 + 14;
  drawText(ctx, 'AIR', airX, 33, { size: 13, weight: 700, color: '#b9b3cc', baseline: 'middle' });
  const barX = airX + 34;
  const barW = 170;
  const airFrac = player.oxygen / player.maxOxygen;
  ctx.fillStyle = 'rgba(20,16,31,0.9)';
  ctx.beginPath();
  ctx.roundRect(barX, 18, barW, 18, 9);
  ctx.fill();
  const lowAir = airFrac < 0.25 && player.gy > SURFACE_ROW;
  const airColor = lowAir ? (Math.floor(time * 4) % 2 === 0 ? '#ff5d6c' : '#c23a46') : PALETTE.teal;
  ctx.fillStyle = airColor;
  if (airFrac > 0) {
    ctx.beginPath();
    ctx.roundRect(barX, 18, Math.max(10, barW * airFrac), 18, 9);
    ctx.fill();
  }
  drawText(ctx, `${Math.ceil(player.oxygen)}`, barX + barW / 2, 28, { size: 13, weight: 700, color: '#14101f', align: 'center', baseline: 'middle' });
  // Depth, centred.
  const depth = Math.max(0, player.gy - SURFACE_ROW);
  drawText(ctx, `DEPTH ${depth}m`, VIEW_W / 2, 22, { size: 20, weight: 700, align: 'center', baseline: 'middle' });
  drawText(ctx, bandAt(player.gy).name, VIEW_W / 2, 42, { size: 13, color: '#b9b3cc', align: 'center', baseline: 'middle' });
  // Gems, score, time, right aligned.
  drawGemShape(ctx, VIEW_W - 316, 27, 18, PALETTE.amber);
  drawText(ctx, `${player.gems}`, VIEW_W - 300, 28, { size: 20, weight: 700, baseline: 'middle' });
  drawText(ctx, `SCORE ${player.score}`, VIEW_W - 236, 28, { size: 18, weight: 700, baseline: 'middle' });
  drawText(ctx, formatTime(game.runTime), VIEW_W - 20, 28, { size: 18, color: '#b9b3cc', align: 'right', baseline: 'middle' });
  if (lowAir) {
    drawText(ctx, 'LOW AIR — HEAD FOR THE SURFACE!', VIEW_W / 2, 76, {
      size: 17, weight: 700, color: Math.floor(time * 3) % 2 === 0 ? '#ff8f98' : '#ffd98a', align: 'center',
    });
  }
  // Depth gauge down the right edge: the whole mountain, and where you are.
  const gaugeX = VIEW_W - 16;
  const gaugeTop = 74;
  const gaugeH = VIEW_H - 170;
  ctx.fillStyle = 'rgba(12,9,24,0.6)';
  ctx.beginPath();
  ctx.roundRect(gaugeX - 4, gaugeTop, 8, gaugeH, 4);
  ctx.fill();
  const depthFrac = Math.min(1, player.maxDepth / 62);
  ctx.fillStyle = PALETTE.amber;
  ctx.beginPath();
  ctx.roundRect(gaugeX - 4, gaugeTop, 8, Math.max(6, gaugeH * depthFrac), 4);
  ctx.fill();
  drawHeartShape(ctx, gaugeX, gaugeTop + gaugeH + 14, 14, PALETTE.heart);
  const markerY = gaugeTop + gaugeH * Math.min(1, depth / 62);
  ctx.fillStyle = PALETTE.paper;
  ctx.beginPath();
  ctx.moveTo(gaugeX - 12, markerY);
  ctx.lineTo(gaugeX - 4, markerY - 6);
  ctx.lineTo(gaugeX - 4, markerY + 6);
  ctx.closePath();
  ctx.fill();
  // Context hint, bottom left; sound state, bottom right.
  drawText(ctx, game.hint, 18, VIEW_H - 18, { size: 15, color: 'rgba(245,238,218,0.85)' });
  drawText(ctx, game.audio.muted ? 'M — sound off' : 'M — sound on', VIEW_W - 18, VIEW_H - 18, { size: 15, color: 'rgba(245,238,218,0.7)', align: 'right' });
}

export function drawToasts(ctx, game) {
  let y = 66;
  for (const toast of game.toasts) {
    const alpha = Math.min(1, toast.life / 0.4);
    ctx.globalAlpha = alpha;
    drawText(ctx, toast.text, VIEW_W / 2, y, { size: 17, weight: 700, color: toast.color, align: 'center' });
    ctx.globalAlpha = 1;
    y += 26;
  }
}

export function drawTitle(ctx, game) {
  const { time, best } = game;
  ctx.fillStyle = 'rgba(10, 8, 20, 0.5)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  try { ctx.letterSpacing = '8px'; } catch { /* older canvas: no letter spacing */ }
  drawText(ctx, 'GLIMMERDEEP', VIEW_W / 2, 158, {
    size: 88, weight: 800, color: '#ffd98a', align: 'center', font: 'Georgia, serif', glow: 'rgba(255,180,58,0.7)',
  });
  ctx.restore();
  drawText(ctx, 'A lantern-lit dig to the Heart of the mountain', VIEW_W / 2, 198, {
    size: 21, color: '#e8e0cc', align: 'center', font: 'Georgia, serif',
  });
  drawText(ctx, "Wren's village is fading. The Heart Crystal, 62 metres down, is the only light that can save it.", VIEW_W / 2, 232, { size: 16, color: '#b9b3cc', align: 'center' });
  drawText(ctx, 'Dig deep. Mind your air. Come back alive.', VIEW_W / 2, 256, { size: 16, color: '#b9b3cc', align: 'center' });
  // How to play.
  drawPanel(ctx, 120, 292, 440, 218);
  drawText(ctx, 'HOW TO PLAY', 148, 326, { size: 19, weight: 800, color: '#ffd98a' });
  const lines = [
    ['WASD / Arrows', 'Move — walk into rock to dig it'],
    ['Mouse', 'Click a next-door cell to dig or step'],
    ['Space / Click a wisp', 'Swing your pickaxe'],
    ['E at the tent', 'Shop, upgrades & rest'],
    ['P — pause', 'M — sound'],
  ];
  lines.forEach(([keys, desc], i) => {
    const y = 358 + i * 30;
    drawText(ctx, keys, 148, y, { size: 15, weight: 700 });
    drawText(ctx, desc, 330, y, { size: 15, color: '#b9b3cc' });
  });
  // Goal and best.
  drawPanel(ctx, 720, 292, 440, 218);
  drawText(ctx, 'THE GOAL', 748, 326, { size: 19, weight: 800, color: '#ffd98a' });
  drawText(ctx, 'Reach the Heart Crystal at the', 748, 358, { size: 15, color: '#e8e0cc' });
  drawText(ctx, 'bottom of the mine and claim it.', 748, 380, { size: 15, color: '#e8e0cc' });
  drawText(ctx, 'Gems buy upgrades at the tent.', 748, 410, { size: 15, color: '#e8e0cc' });
  drawText(ctx, 'Air runs out underground —', 748, 432, { size: 15, color: '#e8e0cc' });
  drawText(ctx, 'surface often, or carry more.', 748, 454, { size: 15, color: '#e8e0cc' });
  drawText(ctx, `BEST  ${best.score > 0 ? `score ${best.score} · depth ${best.depth}m` : 'no delves yet'}${best.wins > 0 ? ` · hearts claimed ${best.wins}` : ''}`, 748, 490, { size: 14, color: '#b9b3cc' });
  game.buttons = [
    makeButton(VIEW_W / 2 - 170, 540, 340, 64, '▼  DESCEND', { type: 'start' }, { sub: 'or press Enter', primary: true }),
  ];
  drawButtons(ctx, game.buttons, game.input.mouse, time);
}

export function drawPause(ctx, game) {
  ctx.fillStyle = 'rgba(10, 8, 20, 0.62)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawPanel(ctx, VIEW_W / 2 - 260, 150, 520, 400);
  drawText(ctx, 'PAUSED', VIEW_W / 2, 208, { size: 44, weight: 800, color: '#ffd98a', align: 'center', font: 'Georgia, serif' });
  drawText(ctx, 'WASD / Arrows — move & dig', VIEW_W / 2, 258, { size: 16, color: '#e8e0cc', align: 'center' });
  drawText(ctx, 'Space — swing pickaxe · E — tent · M — sound', VIEW_W / 2, 284, { size: 16, color: '#e8e0cc', align: 'center' });
  drawText(ctx, 'Click a next-door cell to dig or step there', VIEW_W / 2, 310, { size: 16, color: '#e8e0cc', align: 'center' });
  game.buttons = [
    makeButton(VIEW_W / 2 - 170, 340, 340, 52, 'Resume', { type: 'resume' }, { sub: 'P / Esc', primary: true }),
    makeButton(VIEW_W / 2 - 170, 404, 340, 52, 'Restart run', { type: 'restart' }, { sub: 'a brand-new cave' }),
    makeButton(VIEW_W / 2 - 170, 468, 340, 52, 'Back to title', { type: 'title' }),
  ];
  drawButtons(ctx, game.buttons, game.input.mouse, game.time);
}

export function drawShopPanel(ctx, game) {
  const { player } = game;
  ctx.fillStyle = 'rgba(10, 8, 20, 0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const px = VIEW_W / 2 - 380;
  const py = 92;
  drawPanel(ctx, px, py, 760, 536);
  drawText(ctx, 'THE TENT — SUPPLY & REST', px + 36, py + 46, { size: 26, weight: 800, color: '#ffd98a', font: 'Georgia, serif' });
  drawGemShape(ctx, px + 620, py + 38, 20, PALETTE.amber);
  drawText(ctx, `${player.gems}`, px + 638, py + 46, { size: 24, weight: 700, baseline: 'middle' });
  drawText(ctx, 'Spend gems on gear. Restoring hearts is free — air refills up here too.', px + 36, py + 74, { size: 14, color: '#b9b3cc' });
  game.buttons = [];
  UPGRADES.forEach((up, i) => {
    const y = py + 96 + i * 74;
    const level = upgradeLevel(player, up.id);
    const cost = upgradeCost(up.id, level);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.0)';
    ctx.fillRect(px + 20, y, 720, 64);
    drawUpgradeIcon(ctx, up.id, px + 52, y + 32, 34);
    drawText(ctx, up.name, px + 84, y + 22, { size: 18, weight: 700 });
    drawText(ctx, up.desc, px + 84, y + 46, { size: 13, color: '#b9b3cc' });
    for (let p = 0; p < up.max; p++) {
      ctx.fillStyle = p < level ? PALETTE.amber : 'rgba(120,116,140,0.5)';
      ctx.beginPath();
      ctx.arc(px + 480 + p * 20, y + 20, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    const afford = cost !== null && player.gems >= cost;
    const label = cost === null ? 'MAX' : `Buy — ${cost}`;
    game.buttons.push(makeButton(px + 566, y + 12, 156, 40, label, { type: 'buy', id: up.id }, {
      sub: `key ${i + 1}`, disabled: !afford && cost !== null ? false : cost === null, primary: false,
    }));
    const btn = game.buttons[game.buttons.length - 1];
    if (cost !== null && !afford) btn.sub = `need ${cost - player.gems} more`;
    if (cost === null) btn.disabled = true;
  });
  game.buttons.push(makeButton(px + 36, py + 470, 320, 44, 'Rest — restore hearts', { type: 'rest' }, { sub: 'free' }));
  game.buttons.push(makeButton(px + 404, py + 470, 320, 44, 'Back to the mine', { type: 'leave' }, { sub: 'E / Esc', primary: true }));
  drawButtons(ctx, game.buttons, game.input.mouse, game.time);
}

export function drawEndScreen(ctx, game, kind) {
  const { player } = game;
  const won = kind === 'victory';
  ctx.fillStyle = won ? 'rgba(30, 18, 4, 0.55)' : 'rgba(6, 5, 16, 0.68)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawText(ctx, won ? 'THE HEART IS FOUND!' : 'LOST IN THE DEEP', VIEW_W / 2, 148, {
    size: 56, weight: 800, color: won ? '#ffd98a' : '#b9b3cc', align: 'center', font: 'Georgia, serif',
    glow: won ? 'rgba(255,93,143,0.6)' : null,
  });
  drawText(ctx, game.endReason, VIEW_W / 2, 190, { size: 19, color: '#e8e0cc', align: 'center' });
  const px = VIEW_W / 2 - 300;
  const py = 224;
  const depthBonus = player.maxDepth * TUNING.depthBonus;
  const rows = [
    ['Time in the mine', formatTime(game.runTime)],
    ['Deepest point', `${player.maxDepth}m — ${bandAt(player.gy).name}`],
    ['Gems gathered', `${player.gemsGathered}`],
    ['Gloom wisps felled', `${player.wispsFelled}`],
    ['Gems & fights', `${player.score}`],
    ['Depth bonus', `+${depthBonus}`],
  ];
  if (won) rows.push(['Heart bonus', `+${TUNING.winBonus}`]);
  const panelH = 40 + rows.length * 29 + (game.newBest ? 68 : 36);
  drawPanel(ctx, px, py, 600, panelH);
  rows.forEach(([label, value], i) => {
    const y = py + 40 + i * 29;
    drawText(ctx, label, px + 40, y, { size: 16, color: '#b9b3cc' });
    drawText(ctx, value, px + 560, y, { size: 16, weight: 700, align: 'right' });
  });
  ctx.fillStyle = PALETTE.hudLine;
  ctx.fillRect(px + 40, py + 40 + rows.length * 29 - 8, 520, 1);
  drawText(ctx, 'FINAL SCORE', px + 40, py + 40 + rows.length * 29 + 22, { size: 20, weight: 800, color: '#ffd98a' });
  drawText(ctx, `${game.finalScore}`, px + 560, py + 40 + rows.length * 29 + 22, { size: 24, weight: 800, color: '#ffd98a', align: 'right' });
  if (game.newBest) {
    drawText(ctx, '★ NEW BEST SCORE ★', VIEW_W / 2, py + 40 + rows.length * 29 + 54, { size: 17, weight: 700, color: '#ffd98a', align: 'center' });
  }
  const buttonsY = py + panelH + 22;
  game.buttons = [
    makeButton(VIEW_W / 2 - 270, buttonsY, 260, 58, won ? 'Play again' : 'Try again', { type: 'restart' }, { sub: 'R / Enter', primary: true }),
    makeButton(VIEW_W / 2 + 10, buttonsY, 260, 58, 'Back to title', { type: 'title' }, { sub: 'T' }),
  ];
  drawButtons(ctx, game.buttons, game.input.mouse, game.time);
}
