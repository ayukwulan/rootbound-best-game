// ROOTBOUND: grow a living root through seven depths — drink deep water,
// split around stone, bloom against the Stone Heart.
//
// The game owns the state machine (menu, play, pause, win, lose), the fixed
// step loop, particles, and the wiring between input, rules, audio and
// rendering. The rules themselves live in root.js, world.js and enemies.js.
import { VIEW_W, VIEW_H, STEP, WORLD_BOTTOM, COLOURS } from './config.js';
import { generateWorld } from './world.js';
import { makeRoot, updateRoot } from './root.js';
import { updateGrubs } from './enemies.js';
import { ensureAudio, playEvent, toggleMute, isMuted } from './audio.js';
import { makeInput, steeringAngle, isBursting, consumePress, mousePoint } from './input.js';
import { drawWorld, drawHUD, cameraFor } from './render.js';
import { drawTitle, drawPause, drawWin, drawLose, hitButton } from './ui.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const params = new URLSearchParams(window.location.search);
const seedParam = Number(params.get('seed'));
const seed = Number.isFinite(seedParam) && seedParam > 0 ? Math.floor(seedParam) : (Date.now() % 2147483647);
const shotName = params.get('shot');

/** A burst of glowing particles at a world point. */
function spawnParticles(game, x, y, color, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.8);
    game.particles.push({
      x, y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v - 20,
      life: 0.7 + Math.random() * 0.5,
      maxLife: 1.2,
      size: 2 + Math.random() * 3.5,
      color,
    });
  }
}

function updateParticles(game, dt) {
  for (const p of game.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 60 * dt;
    p.life -= dt;
  }
  game.particles = game.particles.filter(p => p.life > 0);
}

class Game {
  constructor() {
    this.best = Number(window.localStorage?.getItem('rootbound-best') || 0);
    this.reset();
    this.screen = 'title';
    this.time = 0;
    this.elapsed = 0;
    this.particles = [];
    this.buttons = [];
    this.shotMode = shotName !== null;
  }

  reset() {
    this.world = generateWorld(seed);
    this.root = makeRoot();
    this.particles = [];
    this.elapsed = 0;
    this.events = [];
  }

  beginPlay() {
    this.reset();
    this.screen = 'play';
  }

  toMenu() {
    this.screen = 'title';
  }

  /** After a step, move to the win/lose screen when the root is done. */
  finishIfOver() {
    if (this.root.won && this.screen === 'play') {
      this.screen = 'win';
      const total = this.root.score + Math.max(0, 600 - Math.floor(this.elapsed)) * 2;
      if (total > this.best) {
        this.best = total;
        try { window.localStorage?.setItem('rootbound-best', String(total)); } catch {}
      }
    } else if (this.root.dead && this.screen === 'play') {
      this.screen = 'lose';
    }
  }

  /**
   * One fixed step of live play. `steer` is { angle, burst } from the
   * autopilot or the real input; null angle keeps the heading.
   */
  step(dt, steer) {
    if (this.screen !== 'play') return;
    this.time += dt;
    this.elapsed += dt;
    const events = [];
    updateRoot(this.root, this.world, steer, dt, this.elapsed, events);
    updateGrubs(this.world, this.root, dt, this.elapsed, events);
    for (const event of events) {
      playEvent(event);
      if (event.type === 'drink') spawnParticles(this, event.x, event.y, COLOURS.water, 6, 70);
      if (event.type === 'hit-stone') spawnParticles(this, event.x, event.y, '#9ca3af', 10, 120);
      if (event.type === 'hit-grub') spawnParticles(this, event.x, event.y, COLOURS.grub, 8, 100);
      if (event.type === 'branch') spawnParticles(this, event.x, event.y, COLOURS.rootGold, 14, 110);
      if (event.type === 'crack') spawnParticles(this, event.x, event.y, COLOURS.vein, 22, 180);
      if (event.type === 'bloom') spawnParticles(this, event.x, event.y, COLOURS.bloom, 60, 220);
      if (event.type === 'wither') spawnParticles(this, event.x, event.y, '#78716c', 20, 90);
    }
    updateParticles(this, dt);
    this.finishIfOver();
  }

  /** Draw the current screen. */
  draw() {
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    const camera = cameraFor(this.root.x, this.root.y);
    if (this.screen === 'title') {
      // A young root grows behind the title.
      drawWorld(ctx, this, camera, this.time);
      const drawn = drawTitle(ctx, this.best);
      this.buttons = drawn.buttons;
      return;
    }
    drawWorld(ctx, this, camera, this.time);
    if (this.screen === 'play' || this.screen === 'pause') {
      drawHUD(ctx, this);
    }
    if (this.screen === 'pause') {
      const drawn = drawPause(ctx);
      this.buttons = drawn.buttons;
    } else if (this.screen === 'win') {
      const drawn = drawWin(ctx, this);
      this.buttons = drawn.buttons;
    } else if (this.screen === 'lose') {
      const drawn = drawLose(ctx, this);
      this.buttons = drawn.buttons;
    } else {
      this.buttons = [];
    }
  }
}

const game = new Game();
const input = makeInput(canvas);
window.__game = game;

let last = performance.now();
let accumulator = 0;

function frame(now) {
  const frameDt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (game.screen === 'play') {
    accumulator += frameDt;
    while (accumulator >= STEP) {
      const angle = steeringAngle(input, game.root, cameraFor(game.root.x, game.root.y), now);
      game.step(STEP, { angle, burst: isBursting(input) });
      accumulator -= STEP;
      if (game.screen !== 'play') { accumulator = 0; break; }
    }
  } else {
    game.time += frameDt;
  }

  // Keys: Enter/Space starts or restarts, P pauses, M mutes.
  if (consumePress(input, 'Enter') || consumePress(input, 'Space')) {
    if (game.screen === 'title' || game.screen === 'win' || game.screen === 'lose') {
      ensureAudio();
      playEvent({ type: 'click' });
      game.beginPlay();
    } else if (game.screen === 'pause') {
      game.screen = 'play';
    }
  }
  if (consumePress(input, 'KeyP') || consumePress(input, 'Escape')) {
    if (game.screen === 'play') game.screen = 'pause';
    else if (game.screen === 'pause') game.screen = 'play';
  }
  if (consumePress(input, 'KeyM')) {
    toggleMute();
  }

  game.draw();
  requestAnimationFrame(frame);
}

// Clicks: buttons first, then anywhere on the title/win/lose screens.
canvas.addEventListener('pointerdown', () => {
  ensureAudio();
  const point = mousePoint(input);
  const label = hitButton(game.buttons, point.x, point.y);
  if (label) {
    playEvent({ type: 'click' });
    if (game.screen === 'title') game.beginPlay();
    else if (game.screen === 'pause') {
      if (label.includes('RESUME')) game.screen = 'play';
      else game.beginPlay();
    } else if (game.screen === 'win' || game.screen === 'lose') game.beginPlay();
    return;
  }
  if (game.screen === 'title' || game.screen === 'win' || game.screen === 'lose') {
    game.beginPlay();
  }
});

// Shot mode (?shot=start|play|boss|end): stage one deterministic frame,
// draw it, and tell the capture script the frame is ready.
if (shotName) {
  const screen = stageShot(game, shotName);
  game.screen = screen === 'title' ? 'title' : screen;
  if (screen === 'win' || screen === 'lose') game.finishIfOver();
  game.draw();
  window.__shotReady = true;
} else {
  window.__shotReady = false;
  requestAnimationFrame(frame);
  // The live game is ready once the first frame draws.
  requestAnimationFrame(() => { window.__shotReady = true; });
}

// Keep the page from scrolling on touch; the canvas takes the pointer.
document.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
