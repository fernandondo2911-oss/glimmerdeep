// Glimmerdeep — the tent shop. One job: the five upgrade tracks, their prices,
// and what buying one does to the delver. The panel itself is drawn by ui.js.

import { SHOP_PRICES, TUNING } from './config.js';

export const UPGRADES = [
  {
    id: 'tank',
    name: 'Oxygen Tank',
    desc: '+40 max air. Dive longer before the dark calls you back.',
    max: 3,
  },
  {
    id: 'drill',
    name: 'Drill Bit',
    desc: 'Dig faster. Tier 1 cracks hard rock; tier 3 crushes boulders.',
    max: 3,
  },
  {
    id: 'lantern',
    name: 'Lantern',
    desc: 'A wider pool of light around you in the deep.',
    max: 3,
  },
  {
    id: 'boots',
    name: 'Swift Boots',
    desc: 'Step quicker between cells. Outrun the gloom wisps.',
    max: 3,
  },
  {
    id: 'plating',
    name: 'Plating',
    desc: '+1 heart, and restores one heart at once.',
    max: 3,
  },
];

export function upgradeLevel(player, id) {
  return player.upgrades[id] || 0;
}

export function upgradeCost(id, level) {
  const prices = SHOP_PRICES[id];
  if (level >= prices.length) return null;
  return prices[level];
}

export function buyUpgrade(player, id) {
  const level = upgradeLevel(player, id);
  const cost = upgradeCost(id, level);
  if (cost === null) return { ok: false, reason: 'Fully upgraded' };
  if (player.gems < cost) return { ok: false, reason: 'Not enough gems' };
  player.gems -= cost;
  player.upgrades[id] = level + 1;
  if (id === 'tank') {
    player.maxOxygen += TUNING.oxygenTankStep;
    player.oxygen = Math.min(player.maxOxygen, player.oxygen + TUNING.oxygenTankStep);
  }
  if (id === 'plating') {
    player.maxHearts += 1;
    player.hearts = Math.min(player.maxHearts, player.hearts + 1);
  }
  return { ok: true, cost };
}

export function restAtTent(player) {
  const healed = player.maxHearts - player.hearts;
  player.hearts = player.maxHearts;
  return healed;
}
