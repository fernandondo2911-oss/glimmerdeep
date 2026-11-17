// Glimmerdeep — keyboard and mouse. One job: turn browser events into a small,
// per-frame state the game reads (held keys, just-pressed keys, mouse position
// and clicks in canvas pixels), and nothing else.

import { VIEW_W, VIEW_H } from './config.js';

export const KEY_BINDINGS = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  swing: ['Space'],
  interact: ['KeyE'],
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM'],
  restart: ['KeyR'],
  confirm: ['Enter', 'NumpadEnter'],
  title: ['KeyT'],
};

const CODE_TO_ACTION = {};
for (const [action, codes] of Object.entries(KEY_BINDINGS)) {
  for (const code of codes) CODE_TO_ACTION[code] = action;
}

export function createInput(canvas) {
  const input = {
    held: new Set(),
    pressed: new Set(),
    mouse: { x: 0, y: 0, down: false, clicked: false, clickedAt: null },
    numberPressed: null,
    canvas,
  };

  window.addEventListener('keydown', (event) => {
    const action = CODE_TO_ACTION[event.code];
    if (action || event.code.startsWith('Digit')) event.preventDefault();
    if (event.repeat) return;
    if (action) {
      input.held.add(action);
      input.pressed.add(action);
    }
    if (event.code.startsWith('Digit')) {
      input.numberPressed = Number(event.code.slice(5));
    }
  });
  window.addEventListener('keyup', (event) => {
    const action = CODE_TO_ACTION[event.code];
    if (action) input.held.delete(action);
  });
  window.addEventListener('blur', () => {
    input.held.clear();
  });

  canvas.addEventListener('mousemove', (event) => {
    const point = toCanvasPoint(canvas, event);
    input.mouse.x = point.x;
    input.mouse.y = point.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    const point = toCanvasPoint(canvas, event);
    input.mouse.x = point.x;
    input.mouse.y = point.y;
    input.mouse.down = true;
  });
  window.addEventListener('mouseup', () => {
    input.mouse.down = false;
  });
  canvas.addEventListener('click', (event) => {
    const point = toCanvasPoint(canvas, event);
    input.mouse.x = point.x;
    input.mouse.y = point.y;
    input.mouse.clicked = true;
    input.mouse.clickedAt = point;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  return input;
}

export function toCanvasPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * VIEW_W,
    y: ((event.clientY - rect.top) / rect.height) * VIEW_H,
  };
}

export function inputDirection(input) {
  if (input.held.has('up')) return { dx: 0, dy: -1 };
  if (input.held.has('down')) return { dx: 0, dy: 1 };
  if (input.held.has('left')) return { dx: -1, dy: 0 };
  if (input.held.has('right')) return { dx: 1, dy: 0 };
  return null;
}

export function wasPressed(input, action) {
  return input.pressed.has(action);
}

// Called once per frame, after the game has read the input, so edges fire once.
export function endFrameInput(input) {
  input.pressed.clear();
  input.mouse.clicked = false;
  input.mouse.clickedAt = null;
  input.numberPressed = null;
}
