// Screenshot staging: each ?shot= name plays the real rules forward from
// a fresh world for a fixed number of steps, steered by a simple autopilot
// (chase the nearest water, steer around the stone straight ahead), so the
// frame is what a short game really looks like and the same seed always
// gives the same frame.
import { STEP, WORLD_W, DEPTH_HEIGHT, BOSS_Y } from './config.js';
import { hitsStone } from './world.js';
import { clamp } from './random.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 22;
const BOSS_SECONDS = 10;
const END_LIMIT_SECONDS = 120;

/**
 * The autopilot's steering angle. It aims at the nearest water droplet
 * ahead of the tip; when a stone sits straight ahead it steers to the
 * clearer side. Returns an absolute angle, or null to go straight.
 */
export function autopilotAngle(game) {
  const { root, world } = game;
  // Find the best water droplet: near, and near the centre of the earth,
  // so the root stays in frame instead of hugging a wall.
  let target = null;
  let bestScore = Infinity;
  for (const water of world.waters) {
    if (water.taken) continue;
    const d = Math.hypot(water.x - root.x, water.y - root.y);
    const score = d + Math.abs(water.x - WORLD_W / 2) * 0.6;
    if (score < bestScore) { bestScore = score; target = water; }
  }
  let angle = target ? Math.atan2(target.y - root.y, target.x - root.x) : Math.PI / 2;

  // Look ahead for a stone on the current heading and dodge it.
  const lookX = root.x + Math.cos(root.angle) * 170;
  const lookY = root.y + Math.sin(root.angle) * 170;
  const stone = hitsStone(world.stones, lookX, lookY, 34);
  if (stone) {
    const leftClear = hitsStone(world.stones, root.x - 120, root.y + 80, 34) === null;
    const rightClear = hitsStone(world.stones, root.x + 120, root.y + 80, 34) === null;
    if (leftClear && !rightClear) angle = Math.PI / 2 + 0.9;
    else if (rightClear && !leftClear) angle = Math.PI / 2 - 0.9;
    else angle = Math.PI / 2 + (stone.x < root.x ? -0.9 : 0.9);
  }
  // Never steer back up: the root always grows down.
  angle = clamp(angle, 0.15, Math.PI - 0.15);
  return angle;
}

/** Step the game forward with the autopilot for `seconds` of play. */
function playForward(game, seconds) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (game.root.dead || game.root.won) break;
    game.step(STEP, { angle: autopilotAngle(game), burst: false });
  }
}

/**
 * Set the game to the named scene and return the screen to draw.
 * 'start' shows the title over a young root; 'play' shows mid-game;
 * 'boss' shows the Stone Heart fight with one vein cracked; 'end' shows
 * the win screen after the heart is cracked.
 */
export function stageShot(game, name) {
  if (name === 'play') {
    game.beginPlay();
    playForward(game, PLAY_SECONDS);
    return 'play';
  }
  if (name === 'boss') {
    game.beginPlay();
    // Grow the root down to the heart's chamber, then fight it.
    const cx = WORLD_W / 2;
    game.root.y = BOSS_Y - 700;
    game.root.x = cx;
    game.root.trail = [{ x: cx, y: BOSS_Y - 1400 }];
    for (let y = BOSS_Y - 1400; y < BOSS_Y - 700; y += 14) {
      game.root.trail.push({ x: cx + Math.sin(y / 90) * 30, y });
    }
    game.root.lastTrailX = cx;
    game.root.lastTrailY = BOSS_Y - 700;
    game.root.maxDepth = 6;
    game.root.score = 640;
    game.root.water = 31;
    game.root.length = 132;
    // One vein already cracked, so the shot shows progress.
    game.world.heart.veins[0].cracked = true;
    game.root.veinsCracked = 1;
    playForward(game, BOSS_SECONDS);
    return 'play';
  }
  if (name === 'end') {
    game.beginPlay();
    const cx = WORLD_W / 2;
    game.root.y = BOSS_Y - 420;
    game.root.x = cx;
    game.root.trail = [{ x: cx, y: BOSS_Y - 1100 }];
    for (let y = BOSS_Y - 1100; y < BOSS_Y - 420; y += 14) {
      game.root.trail.push({ x: cx + Math.sin(y / 90) * 30, y });
    }
    game.root.lastTrailX = cx;
    game.root.lastTrailY = BOSS_Y - 420;
    game.root.maxDepth = 6;
    game.root.score = 980;
    game.root.water = 47;
    game.root.length = 188;
    game.root.health = 64;
    // Two veins cracked; the autopilot hunts the last one.
    game.world.heart.veins[0].cracked = true;
    game.world.heart.veins[1].cracked = true;
    game.root.veinsCracked = 2;
    // Aim the autopilot at the last vein first, then let it play.
    const steps = Math.floor(END_LIMIT_SECONDS / STEP);
    for (let i = 0; i < steps; i += 1) {
      if (game.root.won || game.root.dead) break;
      const vein = game.world.heart.veins[2];
      const toVein = Math.atan2(vein.y - game.root.y, vein.x - game.root.x);
      const d = Math.hypot(vein.x - game.root.x, vein.y - game.root.y);
      const angle = d < 700 ? toVein : autopilotAngle(game);
      game.step(STEP, { angle, burst: d > 300 });
    }
    if (!game.root.won && !game.root.dead) {
      // The staged win: crack the last vein through the real rules.
      const vein = game.world.heart.veins[2];
      game.root.x = vein.x;
      game.root.y = vein.y;
      game.step(STEP, { angle: null, burst: false });
    }
    game.finishIfOver();
    return game.root.won ? 'win' : 'lose';
  }
  // Default: the title screen over a young root.
  game.beginPlay();
  playForward(game, START_SECONDS);
  game.toMenu();
  return 'title';
}
