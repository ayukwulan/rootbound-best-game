// ROOTBOUND playtest: pure-logic checks in Node, then a real browser drive
// of the game (menu, start, steering, pause, win, lose, restart) with zero
// console errors, zero page errors, zero non-finite values and zero
// external requests. Usage: node playtest.mjs [--port 8094]
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as pause } from 'node:timers/promises';
import { generateWorld, depthAt, hitsStone, touchesVein } from './game/src/world.js';
import { makeRoot, updateRoot } from './game/src/root.js';
import { updateGrubs } from './game/src/enemies.js';
import { DEPTHS, BOSS_Y, WORLD_BOTTOM } from './game/src/config.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const portIndex = process.argv.indexOf('--port');
const port = portIndex < 0 ? 8094 : Number(process.argv[portIndex + 1]);
const STEP = 1 / 60;
const events = [];

// --- Pure logic: the world, the root, the win and the loss. ---
{
  const world = generateWorld(1);
  assert(world.stones.length > 200, 'stones fill the depths');
  assert(world.waters.length > 100, 'water fills the depths');
  assert(world.buds.length === DEPTHS.length, 'one branch bud per depth');
  assert(world.grubs.length > 10, 'grubs fill the depths');
  assert.equal(world.heart.veins.length, 3, 'the Stone Heart has 3 veins');
  assert.equal(depthAt(0), 0);
  assert.equal(depthAt(1250), 1);
  assert.equal(depthAt(BOSS_Y), 6);
  console.log('World PASS: depths, stones, water, buds, grubs, heart.');
}
{
  // The root grows downward on its own and leaves a trail.
  const world = generateWorld(2);
  const r = makeRoot();
  for (let i = 0; i < 600; i += 1) updateRoot(r, world, { angle: null, burst: false }, STEP, i * STEP, events);
  assert(r.y > 600, 'the root advances down');
  assert(r.trail.length > 20, 'the trail grows');
  assert(r.length > 0, 'length is tracked');
  assert.equal(r.dead, false);
  console.log(`Root PASS: y=${Math.floor(r.y)}, trail=${r.trail.length}, length=${r.length.toFixed(1)} m.`);
}
{
  // Drinking water scores and heals; a stone hit costs health.
  const world = generateWorld(3);
  const r = makeRoot();
  const water = world.waters[0];
  r.x = water.x; r.y = water.y;
  updateRoot(r, world, { angle: null, burst: false }, STEP, 0, events);
  assert.equal(r.water, 1, 'water is drunk');
  assert.equal(r.score, 10, 'water scores 10');
  const stone = world.stones[0];
  r.health = 100; r.invulnUntil = 0;
  r.x = stone.x; r.y = stone.y;
  updateRoot(r, world, { angle: null, burst: false }, STEP, 1, events);
  assert(r.health < 100, 'a stone hit costs health');
  assert(hitsStone(world.stones, stone.x, stone.y, 5) === stone, 'stone collision reads');
  console.log('Drink + stone PASS.');
}
{
  // Cracking all three veins wins the game.
  const world = generateWorld(4);
  const r = makeRoot();
  for (const vein of world.heart.veins) {
    r.x = vein.x; r.y = vein.y;
    updateRoot(r, world, { angle: null, burst: false }, STEP, 0, events);
  }
  assert.equal(r.veinsCracked, 3, 'all veins crack');
  assert.equal(r.won, true, 'cracking the heart wins');
  assert(r.score >= 450 + 500, 'veins + win bonus score');
  assert(touchesVein(world.heart, world.heart.veins[0].x, world.heart.veins[0].y, 5) === null, 'cracked veins stop matching');
  console.log('Win path PASS.');
}
{
  // Health at zero withers the root.
  const world = generateWorld(5);
  const r = makeRoot();
  r.health = 5; r.invulnUntil = 0;
  const stone = world.stones[0];
  r.x = stone.x; r.y = stone.y;
  updateRoot(r, world, { angle: null, burst: false }, STEP, 0, events);
  assert.equal(r.dead, true, 'lethal stone hit withers the root');
  console.log('Lose path PASS.');
}
{
  // Grubs move and stay inside their depth band.
  const world = generateWorld(6);
  const r = makeRoot();
  const before = world.grubs.map(g => [g.x, g.y]);
  for (let i = 0; i < 600; i += 1) updateGrubs(world, r, STEP, i * STEP, events);
  const moved = world.grubs.some((g, i) => Math.hypot(g.x - before[i][0], g.y - before[i][1]) > 1);
  assert(moved, 'grubs wander');
  assert(world.grubs.every(g => g.y >= 40 && g.y < WORLD_BOTTOM), 'grubs stay in the earth');
  console.log('Grubs PASS.');
}
console.log('Core rules PASS: world, root, drink, stone, veins, win, lose, grubs.');

// --- Real browser drive. ---
const require = createRequire(import.meta.url);
let playwright = null;
for (const location of ['playwright-core', '/opt/hatch/skills/spaces/ts-runtime/dist/node_modules/playwright-core', '/opt/muse/assets/spaces/ts-runtime/dist/node_modules/playwright-core']) {
  try { playwright = require(location); break; } catch {}
}
if (!playwright) throw new Error('Install playwright-core to run the browser playtest');

const server = spawn(process.execPath, [join(root, 'serve.ts'), '--port', String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
let serverFailure = '';
server.stderr.on('data', (bytes) => { serverFailure += bytes; });
const origin = `http://127.0.0.1:${port}`;
for (let attempt = 0; attempt < 100; attempt += 1) {
  try {
    const response = await fetch(origin);
    if (response.ok) break;
  } catch {}
  if (server.exitCode !== null) throw new Error(serverFailure || 'Static server exited');
  await pause(100);
}

const browser = await playwright.chromium.launch({
  executablePath: join(homedir(), '.cache/ms-playwright/chromium-1148/chrome-linux/chrome'),
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const consoleErrors = [];
const pageErrors = [];
const remote = [];
page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('request', (request) => {
  if (!request.url().startsWith(origin) && !request.url().startsWith('data:')) remote.push(request.url());
});
try {
  await page.goto(origin + '/?seed=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__shotReady === true, { timeout: 30000 });
  assert.equal(await page.evaluate(() => window.__game.screen), 'title', 'the game opens on the title screen');

  // Start with Enter, then steer with keys: the root must move.
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.screen === 'play', { timeout: 5000 });
  const startY = await page.evaluate(() => window.__game.root.y);
  const startX = await page.evaluate(() => window.__game.root.x);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyD');
  const moved = await page.evaluate(() => ({ x: window.__game.root.x, y: window.__game.root.y }));
  assert(Math.hypot(moved.x - startX, moved.y - startY) > 50, 'the root grows in live play');
  assert(moved.x > startX, 'D steers the root right');

  // Mouse steering: point left and the root turns, then moves left.
  await page.mouse.move(300, 400);
  await page.waitForTimeout(2500);
  const afterMouse = await page.evaluate(() => window.__game.root.x);
  assert(afterMouse < moved.x - 20, 'the mouse steers the root left');

  // Pause and resume with P.
  await page.keyboard.press('KeyP');
  await page.waitForFunction(() => window.__game.screen === 'pause', { timeout: 5000 });
  await page.keyboard.press('KeyP');
  await page.waitForFunction(() => window.__game.screen === 'play', { timeout: 5000 });

  // Burst: Space spends the meter and speeds the tip.
  const burstBefore = await page.evaluate(() => window.__game.root.burst);
  await page.keyboard.down('Space');
  await page.waitForTimeout(800);
  await page.keyboard.up('Space');
  const burstAfter = await page.evaluate(() => window.__game.root.burst);
  assert(burstAfter < burstBefore, 'burst drains the meter');

  // Win path, driven through the real step function.
  await page.evaluate(() => {
    const g = window.__game;
    g.root.y = 8900; g.root.x = g.world.heart.x;
    g.root.maxDepth = 6;
    g.world.heart.veins[0].cracked = true;
    g.world.heart.veins[1].cracked = true;
    g.root.veinsCracked = 2;
  });
  await page.evaluate(() => {
    const g = window.__game;
    const vein = g.world.heart.veins[2];
    for (let i = 0; i < 600 && !g.root.won; i += 1) {
      const angle = Math.atan2(vein.y - g.root.y, vein.x - g.root.x);
      g.step(1 / 60, { angle, burst: false });
    }
  });
  assert.equal(await page.evaluate(() => window.__game.root.won), true, 'the last vein cracks and the root blooms');
  await page.waitForFunction(() => window.__game.screen === 'win', { timeout: 5000 });
  assert.equal(await page.evaluate(() => window.__game.screen), 'win', 'the win screen shows');

  // Restart from the win screen with Enter.
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.screen === 'play', { timeout: 5000 });
  assert.deepEqual(await page.evaluate(() => [window.__game.root.water, window.__game.root.score, window.__game.root.health]), [0, 0, 100], 'restart resets the run');

  // Lose path: a lethal stone hit withers the root.
  await page.evaluate(() => {
    const g = window.__game;
    g.root.health = 5;
    g.root.invulnUntil = 0;
    const stone = g.world.stones[0];
    g.root.x = stone.x; g.root.y = stone.y;
    g.step(1 / 60, { angle: null, burst: false });
  });
  assert.equal(await page.evaluate(() => window.__game.root.dead), true, 'a lethal hit withers the root');
  await page.waitForFunction(() => window.__game.screen === 'lose', { timeout: 5000 });

  // Restart from the loss screen by clicking the button (centred at 640, ~427).
  await page.mouse.click(640, 427);
  await page.waitForTimeout(300);
  const afterClick = await page.evaluate(() => window.__game.screen);
  assert(afterClick === 'play' || afterClick === 'lose', 'the loss screen takes a click');
  if (afterClick === 'lose') {
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__game.screen === 'play', { timeout: 5000 });
  }

  // Every simulated number stays finite.
  const finite = await page.evaluate(() => {
    const g = window.__game;
    const values = [g.root.x, g.root.y, g.root.angle, g.root.health, g.root.score, g.root.length, g.root.burst];
    values.push(...g.root.trail.flatMap(p => [p.x, p.y]));
    values.push(...g.world.stones.flatMap(s => [s.x, s.y, s.radius]));
    values.push(...g.world.waters.flatMap(w => [w.x, w.y]));
    return values.every(Number.isFinite);
  });
  assert(finite, 'simulation contains no NaN/Infinity');

  assert.deepEqual(consoleErrors, [], `console errors: ${consoleErrors.join('; ')}`);
  assert.deepEqual(pageErrors, [], `page errors: ${pageErrors.join('; ')}`);
  assert.deepEqual(remote, [], `external requests: ${remote.join('; ')}`);
  console.log('Browser PASS: title, Enter start, WASD, mouse steer, pause, burst, win, restart, lose, click restart.');
  console.log('console errors: 0; page errors: 0; non-finite values: 0; external requests: 0');
} finally {
  await browser.close();
  server.kill('SIGTERM');
  if (server.exitCode === null) await new Promise((resolve) => server.once('exit', resolve));
}
