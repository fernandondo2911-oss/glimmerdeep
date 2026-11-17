// Glimmerdeep — boot and frame loop. One job: start the game, run it on a
// fixed 60 Hz step, and serve the deterministic screenshot scenes (?shot=)
// with one frozen frame and a ready flag for the capture tool.

import { createGame, update, render } from './game.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
const game = createGame(canvas);
window.__game = game;

window.addEventListener('error', (event) => {
  window.__shotError = String(event.message || 'unknown error');
});

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');

if (shot) {
  try {
    const seed = Number(params.get('seed') || 1);
    applyShot(game, shot, seed);
    render(game);
    window.__shotReady = true;
  } catch (err) {
    window.__shotError = String((err && err.message) || err);
  }
} else {
  let last = performance.now();
  let acc = 0;
  let lastState = game.state;
  const STEP = 1 / 60;
  const announce = {
    title: 'Glimmerdeep title screen. Press Enter to descend.',
    playing: 'Playing Glimmerdeep.',
    paused: 'Game paused.',
    shop: 'Tent shop open.',
    victory: 'Victory! The Heart Crystal is found.',
    defeat: 'Defeat. The delve is over.',
  };
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.min(dt, 0.1);
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 4) {
      update(game, STEP);
      acc -= STEP;
      steps++;
    }
    if (steps === 4) acc = 0;
    render(game);
    if (game.state !== lastState) {
      lastState = game.state;
      if (statusLine) statusLine.textContent = announce[game.state] || '';
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
