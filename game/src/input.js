// Input: mouse steering (primary) and WASD / arrow keys, plus the action
// keys. The root tip steers toward the mouse point when the mouse has
// moved recently; otherwise the held keys steer it. Space bursts.
import { VIEW_W, VIEW_H } from './config.js';

/** Fresh input state, bound to a canvas. */
export function makeInput(canvas) {
  const input = {
    keys: new Set(),
    mouseX: VIEW_W / 2,
    mouseY: VIEW_H / 2,
    mouseSeen: 0, // last time the mouse moved (performance.now ms)
    mouseDown: false,
    pressed: new Set(), // keys pressed since last consume (edge-triggered)
  };

  function toCanvas(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (VIEW_W / rect.width),
      y: (clientY - rect.top) * (VIEW_H / rect.height),
    };
  }

  canvas.addEventListener('pointermove', (event) => {
    const point = toCanvas(event.clientX, event.clientY);
    input.mouseX = point.x;
    input.mouseY = point.y;
    input.mouseSeen = performance.now();
  });
  canvas.addEventListener('pointerdown', (event) => {
    const point = toCanvas(event.clientX, event.clientY);
    input.mouseX = point.x;
    input.mouseY = point.y;
    input.mouseSeen = performance.now();
    input.mouseDown = true;
  });
  window.addEventListener('pointerup', () => {
    input.mouseDown = false;
  });
  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) input.pressed.add(event.code);
    input.keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseDown = false;
  });

  return input;
}

/** True once for a key pressed since the last call (edge-triggered). */
export function consumePress(input, code) {
  if (input.pressed.has(code)) {
    input.pressed.delete(code);
    return true;
  }
  return false;
}

/**
 * The steering angle for the root tip, or null to keep the current heading.
 * Mouse wins when it moved in the last 1.5 s; keys steer otherwise.
 * `tip` is { x, y } in world coordinates; `camera` is the view's top-left.
 */
export function steeringAngle(input, tip, camera, nowMs) {
  const keys = input.keys;
  let dx = 0;
  let dy = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
  if (dx !== 0 || dy !== 0) return Math.atan2(dy, dx);

  // Mouse: steer toward the pointer, but only when it is not on the tip.
  if (nowMs - input.mouseSeen < 1500) {
    const mx = input.mouseX + camera.x;
    const my = input.mouseY + camera.y;
    const mdx = mx - tip.x;
    const mdy = my - tip.y;
    if (Math.hypot(mdx, mdy) > 24) return Math.atan2(mdy, mdx);
  }
  return null;
}

/** True while the burst key (Space or Shift) is held. */
export function isBursting(input) {
  return input.keys.has('Space') || input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
}

/** Mouse position in canvas coordinates (for button hit-testing). */
export function mousePoint(input) {
  return { x: input.mouseX, y: input.mouseY };
}
