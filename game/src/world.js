// The earth itself: seven depths of soil, the stones, water, grubs and
// branch buds scattered through them, and the Stone Heart at the bottom.
// Generation is seeded, so the same seed grows the same world.
import {
  VIEW_W, WORLD_W, DEPTHS, DEPTH_HEIGHT, BOSS_Y, HEART_RADIUS, HEART_VEINS,
  VEIN_RADIUS, WATER_RADIUS, BUD_RADIUS, GRUB_RADIUS,
} from './config.js';
import { mulberry32, range, int, chance } from './random.js';

const STONE_BASE = 46; // stones per depth band, before the depth multiplier
const WATER_BASE = 26; // water droplets per depth band
const BUDS_PER_DEPTH = 1;

/** Which depth band a y coordinate sits in (0..6). */
export function depthAt(y) {
  const index = Math.floor(y / DEPTH_HEIGHT);
  return index < 0 ? 0 : index >= DEPTHS.length ? DEPTHS.length - 1 : index;
}

/** The depth band object for a y coordinate. */
export function depthInfo(y) {
  return DEPTHS[depthAt(y)];
}

/** A rough stone: a polygon of 7 points around a centre. */
function makeStone(rng, x, y) {
  const radius = range(rng, 22, 52);
  const points = [];
  const count = 7;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const r = radius * range(rng, 0.75, 1.15);
    points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
  }
  return { x, y, radius, points, seed: rng() };
}

/** Build the whole world for a seed. Entities are grouped per depth band. */
export function generateWorld(seed) {
  const rng = mulberry32(seed);
  const stones = [];
  const waters = [];
  const buds = [];
  const grubs = [];
  const speckles = []; // static soil dots, drawn behind everything

  for (let d = 0; d < DEPTHS.length; d += 1) {
    const depth = DEPTHS[d];
    const top = d * DEPTH_HEIGHT;
    // A clear starting shaft: no stones in the first 240 px of Topsoil.
    const stoneTop = d === 0 ? top + 260 : top + 40;
    const stoneCount = Math.round(STONE_BASE * depth.stone);
    for (let i = 0; i < stoneCount; i += 1) {
      const x = range(rng, 60, WORLD_W - 60);
      const y = range(rng, stoneTop, top + DEPTH_HEIGHT - 60);
      // Keep a winding gap near the centre so a careful player can pass.
      if (Math.abs(x - WORLD_W / 2) < 70 && chance(rng, 0.55)) continue;
      stones.push(makeStone(rng, x, y));
    }
    const waterCount = Math.round(WATER_BASE * depth.water);
    for (let i = 0; i < waterCount; i += 1) {
      waters.push({
        x: range(rng, 40, WORLD_W - 40),
        y: range(rng, top + 60, top + DEPTH_HEIGHT - 60),
        taken: false,
        phase: range(rng, 0, Math.PI * 2),
      });
    }
    for (let i = 0; i < BUDS_PER_DEPTH; i += 1) {
      buds.push({
        x: range(rng, 80, WORLD_W - 80),
        y: range(rng, top + 200, top + DEPTH_HEIGHT - 200),
        taken: false,
        phase: range(rng, 0, Math.PI * 2),
      });
    }
    for (let i = 0; i < depth.grubs; i += 1) {
      grubs.push({
        x: range(rng, 80, WORLD_W - 80),
        y: range(rng, top + 200, top + DEPTH_HEIGHT - 200),
        bandTop: top,
        angle: range(rng, 0, Math.PI * 2),
        speed: range(rng, 30, 55),
        phase: range(rng, 0, Math.PI * 2),
        nibbleAt: 0,
        radius: GRUB_RADIUS,
      });
    }
    for (let i = 0; i < 260; i += 1) {
      speckles.push({
        x: range(rng, 0, WORLD_W),
        y: range(rng, top, top + DEPTH_HEIGHT),
        r: range(rng, 1, 3.2),
        shade: range(rng, 0.04, 0.12),
      });
    }
  }

  // The Stone Heart waits in a wide chamber below The Deep.
  const heart = {
    x: WORLD_W / 2,
    y: BOSS_Y,
    radius: HEART_RADIUS,
    veins: [],
  };
  for (let i = 0; i < HEART_VEINS; i += 1) {
    // Veins on the upper face, where the root can reach them.
    const angle = -Math.PI / 2 + (i - (HEART_VEINS - 1) / 2) * 0.85;
    heart.veins.push({
      angle,
      x: heart.x + Math.cos(angle) * (HEART_RADIUS - 12),
      y: heart.y + Math.sin(angle) * (HEART_RADIUS - 12),
      radius: VEIN_RADIUS,
      cracked: false,
    });
  }
  // A few grubs guard the heart, in the chamber band below The Deep.
  for (let i = 0; i < 4; i += 1) {
    grubs.push({
      x: heart.x + range(rng, -420, 420),
      y: heart.y + range(rng, -260, 120),
      bandTop: DEPTHS.length * DEPTH_HEIGHT,
      angle: range(rng, 0, Math.PI * 2),
      speed: range(rng, 40, 60),
      phase: range(rng, 0, Math.PI * 2),
      nibbleAt: 0,
      radius: GRUB_RADIUS,
    });
  }

  return { seed, stones, waters, buds, grubs, speckles, heart };
}

/** Distance from a point to a stone's edge (negative when inside). */
export function stoneClearance(stone, x, y) {
  return Math.hypot(x - stone.x, y - stone.y) - stone.radius * 0.92;
}

/** True when the circle at (x, y, r) overlaps any stone near it. */
export function hitsStone(stones, x, y, r) {
  for (let i = 0; i < stones.length; i += 1) {
    const stone = stones[i];
    if (Math.abs(stone.x - x) > 120 || Math.abs(stone.y - y) > 120) continue;
    if (stoneClearance(stone, x, y) < r) return stone;
  }
  return null;
}

/** True when the circle overlaps the Stone Heart's body. */
export function hitsHeart(heart, x, y, r) {
  return Math.hypot(x - heart.x, y - heart.y) < heart.radius - 6 + r;
}

/** The first uncracked vein the circle touches, or null. */
export function touchesVein(heart, x, y, r) {
  for (const vein of heart.veins) {
    if (vein.cracked) continue;
    if (Math.hypot(x - vein.x, y - vein.y) < vein.radius + r) return vein;
  }
  return null;
}

/** Count of cracked veins. */
export function crackedVeins(heart) {
  let count = 0;
  for (const vein of heart.veins) if (vein.cracked) count += 1;
  return count;
}

/** Water droplets within reach of a point, for collection. */
export function watersNear(waters, x, y, r, out) {
  for (let i = 0; i < waters.length; i += 1) {
    const water = waters[i];
    if (water.taken) continue;
    if (Math.abs(water.x - x) > 60 || Math.abs(water.y - y) > 60) continue;
    if (Math.hypot(water.x - x, water.y - y) < WATER_RADIUS + r) out.push(water);
  }
  return out;
}

/** Branch buds within reach of a point. */
export function budsNear(buds, x, y, r, out) {
  for (let i = 0; i < buds.length; i += 1) {
    const bud = buds[i];
    if (bud.taken) continue;
    if (Math.abs(bud.x - x) > 60 || Math.abs(bud.y - y) > 60) continue;
    if (Math.hypot(bud.x - x, bud.y - y) < BUD_RADIUS + r) out.push(bud);
  }
  return out;
}
