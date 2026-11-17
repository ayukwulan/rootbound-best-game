// The living root: a tip that grows on its own while the player steers it,
// the trail it leaves behind, and the branch tips a bud splits off.
// Pure logic — no DOM, no canvas — so the playtest can run it in Node.
import {
  WORLD_W, TIP_SPEED, BURST_SPEED, BURST_DRAIN, BURST_REGEN, TURN_RATE,
  TIP_RADIUS, TRAIL_MAX, TRAIL_SPACING, HEALTH_MAX, STONE_DAMAGE,
  GRUB_DAMAGE, WATER_HEAL, WATER_SCORE, VEIN_SCORE, WIN_BONUS,
  DEPTH_SCORE, INVULN_SECONDS, BRANCH_MAX, BRANCH_LIFE, DEPTHS,
  DEPTH_HEIGHT, WORLD_BOTTOM,
} from './config.js';
import { clamp, angleDelta } from './random.js';
import {
  depthAt, hitsStone, hitsHeart, touchesVein, crackedVeins,
  watersNear, budsNear,
} from './world.js';

/** A fresh root at the surface, pointing down. */
export function makeRoot() {
  return {
    x: WORLD_W / 2,
    y: 60,
    angle: Math.PI / 2, // straight down
    speed: TIP_SPEED,
    trail: [{ x: WORLD_W / 2, y: 20 }, { x: WORLD_W / 2, y: 60 }],
    lastTrailX: WORLD_W / 2,
    lastTrailY: 60,
    health: HEALTH_MAX,
    score: 0,
    water: 0,
    length: 0, // metres grown
    maxDepth: 0,
    burst: 100, // burst meter 0..100
    bursting: false,
    invulnUntil: 0,
    branches: [],
    veinsCracked: 0,
    won: false,
    dead: false,
  };
}

/** A branch tip: an autopilot offshoot that hunts water on its own. */
function makeBranch(x, y, angle) {
  return {
    x, y, angle,
    speed: TIP_SPEED * 0.95,
    trail: [{ x, y }],
    lastTrailX: x,
    lastTrailY: y,
    life: BRANCH_LIFE,
    dead: false,
  };
}

/**
 * Steer the main tip toward a target angle, limited by the turn rate, then
 * advance. `steer` is { angle } (absolute) or null to keep going straight.
 */
function advanceTip(tip, dt, targetAngle, speed) {
  if (targetAngle !== null && targetAngle !== undefined) {
    const delta = angleDelta(tip.angle, targetAngle);
    const maxTurn = TURN_RATE * dt;
    tip.angle += clamp(delta, -maxTurn, maxTurn);
  }
  tip.x += Math.cos(tip.angle) * speed * dt;
  tip.y += Math.sin(tip.angle) * speed * dt;
  tip.x = clamp(tip.x, 24, WORLD_W - 24);
  if (tip.y < 30) { tip.y = 30; tip.angle = Math.PI / 2; }
  if (tip.y > WORLD_BOTTOM) { tip.y = WORLD_BOTTOM; tip.angle = -Math.PI / 2; }
  // Lay trail points as the tip moves.
  const dx = tip.x - tip.lastTrailX;
  const dy = tip.y - tip.lastTrailY;
  if (Math.hypot(dx, dy) >= TRAIL_SPACING) {
    tip.trail.push({ x: tip.x, y: tip.y });
    tip.lastTrailX = tip.x;
    tip.lastTrailY = tip.y;
    tip.length += Math.hypot(dx, dy) / 50; // metres, roughly
    if (tip.trail.length > TRAIL_MAX) tip.trail.splice(0, tip.trail.length - TRAIL_MAX);
  }
}

/** The nearest water droplet ahead of a tip, or null. */
function nearestWater(waters, x, y) {
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < waters.length; i += 1) {
    const water = waters[i];
    if (water.taken) continue;
    const d = Math.hypot(water.x - x, water.y - y);
    if (d < bestD) { bestD = d; best = water; }
  }
  return best;
}

/**
 * One fixed step of the root. `input` is { angle } (absolute steering
 * angle or null), { burst } (true while the burst key is held), and the
 * world. `events` collects { type, ... } for sound and feedback.
 * Returns nothing; the root and world are mutated.
 */
export function updateRoot(root, world, input, dt, now, events) {
  if (root.dead || root.won) return;

  // Burst: faster while the meter lasts.
  root.bursting = input.burst && root.burst > 0;
  const speed = root.bursting ? BURST_SPEED : TIP_SPEED;
  if (root.bursting) root.burst = Math.max(0, root.burst - BURST_DRAIN * dt);
  else root.burst = Math.min(100, root.burst + BURST_REGEN * dt);

  advanceTip(root, dt, input.angle, speed);

  // Stones: bounce off and take damage (once per invulnerability window).
  const stone = hitsStone(world.stones, root.x, root.y, TIP_RADIUS);
  if (stone) {
    const away = Math.atan2(root.y - stone.y, root.x - stone.x);
    root.angle = away + (root.angle - away > 0 ? 0.6 : -0.6);
    root.x = stone.x + Math.cos(away) * (stone.radius + TIP_RADIUS + 2);
    root.y = stone.y + Math.sin(away) * (stone.radius + TIP_RADIUS + 2);
    if (now >= root.invulnUntil) {
      root.health -= STONE_DAMAGE;
      root.invulnUntil = now + INVULN_SECONDS;
      events.push({ type: 'hit-stone', x: root.x, y: root.y });
    }
  }

  // The Stone Heart is solid rock: slide around it, in the direction the
  // player is steering (the tangent that best matches the input angle).
  if (hitsHeart(world.heart, root.x, root.y, TIP_RADIUS)) {
    const away = Math.atan2(root.y - world.heart.y, root.x - world.heart.x);
    root.x = world.heart.x + Math.cos(away) * (world.heart.radius + TIP_RADIUS);
    root.y = world.heart.y + Math.sin(away) * (world.heart.radius + TIP_RADIUS);
    const clockwise = away + Math.PI / 2;
    const counter = away - Math.PI / 2;
    const want = input.angle !== null && input.angle !== undefined ? input.angle : root.angle;
    root.angle = Math.cos(clockwise - want) >= Math.cos(counter - want) ? clockwise : counter;
  }

  // Veins: touch one and it cracks.
  const vein = touchesVein(world.heart, root.x, root.y, TIP_RADIUS);
  if (vein) {
    vein.cracked = true;
    root.veinsCracked = crackedVeins(world.heart);
    root.score += VEIN_SCORE;
    events.push({ type: 'crack', x: vein.x, y: vein.y, cracked: root.veinsCracked });
    if (root.veinsCracked >= world.heart.veins.length) {
      root.won = true;
      root.score += WIN_BONUS;
      events.push({ type: 'bloom', x: root.x, y: root.y });
    }
  }

  // Water: drink it for score and a little health.
  const near = [];
  watersNear(world.waters, root.x, root.y, TIP_RADIUS + 6, near);
  for (const water of near) {
    water.taken = true;
    root.water += 1;
    root.score += WATER_SCORE;
    root.health = Math.min(HEALTH_MAX, root.health + WATER_HEAL);
    events.push({ type: 'drink', x: water.x, y: water.y });
  }

  // Branch buds: split off a second tip.
  const buds = [];
  budsNear(world.buds, root.x, root.y, TIP_RADIUS + 6, buds);
  for (const bud of buds) {
    bud.taken = true;
    if (root.branches.length < BRANCH_MAX) {
      root.branches.push(makeBranch(root.x, root.y, root.angle - 0.7));
      events.push({ type: 'branch', x: bud.x, y: bud.y });
    } else {
      root.score += WATER_SCORE * 2;
      events.push({ type: 'drink', x: bud.x, y: bud.y });
    }
  }

  // Depth reached: score the first time each depth is entered.
  const depth = depthAt(root.y);
  if (depth > root.maxDepth) {
    root.maxDepth = depth;
    root.score += DEPTH_SCORE;
    events.push({ type: 'depth', depth, name: DEPTHS[depth].name });
  }

  // Branch tips: autopilot toward the nearest water, die on stone.
  for (const branch of root.branches) {
    if (branch.dead) continue;
    branch.life -= dt;
    if (branch.life <= 0) { branch.dead = true; continue; }
    const target = nearestWater(world.waters, branch.x, branch.y);
    const targetAngle = target ? Math.atan2(target.y - branch.y, target.x - branch.x) : null;
    advanceTip(branch, dt, targetAngle, branch.speed);
    if (hitsStone(world.stones, branch.x, branch.y, TIP_RADIUS)) {
      branch.dead = true;
      events.push({ type: 'branch-lost', x: branch.x, y: branch.y });
      continue;
    }
    const branchNear = [];
    watersNear(world.waters, branch.x, branch.y, TIP_RADIUS + 6, branchNear);
    for (const water of branchNear) {
      water.taken = true;
      root.water += 1;
      root.score += WATER_SCORE;
      events.push({ type: 'drink', x: water.x, y: water.y });
    }
  }
  root.branches = root.branches.filter(b => !b.dead);

  if (root.health <= 0) {
    root.health = 0;
    root.dead = true;
    events.push({ type: 'wither', x: root.x, y: root.y });
  }
}

/** Grubs nibble the root: contact with the tip or the trail costs health. */
export function grubBite(root, grub, now, events) {
  if (root.dead || root.won) return;
  if (now < root.invulnUntil) return;
  // Tip contact.
  if (Math.hypot(grub.x - root.x, grub.y - root.y) < grub.radius + TIP_RADIUS) {
    root.health -= GRUB_DAMAGE;
    root.invulnUntil = now + INVULN_SECONDS;
    events.push({ type: 'hit-grub', x: grub.x, y: grub.y });
    return;
  }
  // Trail contact: check the trail points near the grub.
  for (let i = root.trail.length - 1; i >= 0; i -= 1) {
    const point = root.trail[i];
    if (Math.abs(point.x - grub.x) > 40 || Math.abs(point.y - grub.y) > 40) continue;
    if (Math.hypot(point.x - grub.x, point.y - grub.y) < grub.radius + 5) {
      root.health -= GRUB_DAMAGE;
      root.invulnUntil = now + INVULN_SECONDS;
      events.push({ type: 'hit-grub', x: grub.x, y: grub.y });
      return;
    }
  }
}
