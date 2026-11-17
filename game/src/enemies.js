// Grubs: root-eating larvae. They wander the soil on a slow sine drift
// and, when the root's trail comes near, turn toward it and nibble.
// Pure logic — no DOM — so the playtest can run it in Node.
import { WORLD_W, GRUB_SPEED, DEPTH_HEIGHT, WORLD_BOTTOM } from './config.js';
import { clamp } from './random.js';
import { grubBite } from './root.js';

/**
 * One fixed step for every grub. Grubs stay inside their own depth band
 * (plus the heart's chamber) and bounce off the walls of the earth.
 */
export function updateGrubs(world, root, dt, now, events) {
  for (const grub of world.grubs) {
    // Wander: a slow turn plus a sine wobble, so no two grubs move alike.
    grub.phase += dt * 1.7;
    grub.angle += Math.sin(grub.phase) * 0.9 * dt;

    // Smell the root: if a trail point is close, turn toward it.
    let nearest = null;
    let nearestD = 130;
    for (let i = root.trail.length - 1; i >= 0; i -= 1) {
      const point = root.trail[i];
      if (Math.abs(point.x - grub.x) > 130 || Math.abs(point.y - grub.y) > 130) continue;
      const d = Math.hypot(point.x - grub.x, point.y - grub.y);
      if (d < nearestD) { nearestD = d; nearest = point; }
    }
    if (nearest) {
      const want = Math.atan2(nearest.y - grub.y, nearest.x - grub.x);
      let delta = (want - grub.angle) % (Math.PI * 2);
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta <= -Math.PI) delta += Math.PI * 2;
      grub.angle += clamp(delta, -2.2 * dt, 2.2 * dt);
    }

    grub.x += Math.cos(grub.angle) * grub.speed * dt;
    grub.y += Math.sin(grub.angle) * grub.speed * dt;
    grub.x = clamp(grub.x, 30, WORLD_W - 30);
    // Stay inside the band the grub was born in, and above the chamber floor.
    const bandTop = grub.bandTop ?? 0;
    if (grub.y < bandTop + 40) { grub.y = bandTop + 40; grub.angle = Math.PI / 2; }
    if (grub.y > bandTop + DEPTH_HEIGHT - 40) { grub.y = bandTop + DEPTH_HEIGHT - 40; grub.angle = -Math.PI / 2; }
    if (grub.y > WORLD_BOTTOM - 40) { grub.y = WORLD_BOTTOM - 40; grub.angle = -Math.PI / 2; }

    // Nibble: a grub on the root costs health, throttled per grub.
    if (now >= grub.nibbleAt) {
      const before = root.health;
      grubBite(root, grub, now, events);
      if (root.health < before) grub.nibbleAt = now + 0.6;
    }
  }
}
