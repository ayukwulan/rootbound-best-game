// Rendering: everything the player sees while playing — the soil, the
// glowing root, stones, water, grubs, the Stone Heart, particles and the
// HUD. Screens (title, pause, results) live in ui.js. All drawing is in
// canvas 2D, no images, no fonts over the network.
import {
  VIEW_W, VIEW_H, WORLD_W, DEPTHS, DEPTH_HEIGHT, WORLD_BOTTOM,
  TIP_RADIUS, COLOURS,
} from './config.js';
import { depthAt } from './world.js';
import { clamp } from './random.js';

/** Camera (world x/y of the view's top-left) keeping the tip centred. */
export function cameraFor(tipX, tipY) {
  return {
    x: clamp(tipX - VIEW_W / 2, 0, Math.max(0, WORLD_W - VIEW_W)),
    y: clamp(tipY - VIEW_H * 0.42, 0, Math.max(0, WORLD_BOTTOM - VIEW_H)),
  };
}

/** Draw the soil for the visible bands, with speckles and band edges. */
function drawSoil(ctx, world, camera) {
  const first = Math.max(0, Math.floor(camera.y / DEPTH_HEIGHT));
  const last = Math.min(DEPTHS.length - 1, Math.floor((camera.y + VIEW_H) / DEPTH_HEIGHT));
  for (let d = first; d <= last; d += 1) {
    const depth = DEPTHS[d];
    const top = d * DEPTH_HEIGHT - camera.y;
    ctx.fillStyle = depth.soil;
    ctx.fillRect(0, top, VIEW_W, DEPTH_HEIGHT);
    // A darker edge where one depth meets the next.
    ctx.fillStyle = depth.dark;
    ctx.fillRect(0, top, VIEW_W, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, top + DEPTH_HEIGHT - 4, VIEW_W, 4);
  }
  // Speckles: only the ones on screen.
  for (const dot of world.speckles) {
    const x = dot.x - camera.x;
    const y = dot.y - camera.y;
    if (x < -4 || x > VIEW_W + 4 || y < -4 || y > VIEW_H + 4) continue;
    ctx.fillStyle = `rgba(0,0,0,${dot.shade})`;
    ctx.beginPath();
    ctx.arc(x, y, dot.r, 0, Math.PI * 2);
    ctx.fill();
  }
  // The chamber floor below the heart.
  const floorY = WORLD_BOTTOM - camera.y;
  if (floorY < VIEW_H) {
    ctx.fillStyle = '#0d0a08';
    ctx.fillRect(0, Math.max(0, floorY), VIEW_W, VIEW_H);
  }
}

function drawStones(ctx, world, camera) {
  for (const stone of world.stones) {
    const x = stone.x - camera.x;
    const y = stone.y - camera.y;
    if (x < -70 || x > VIEW_W + 70 || y < -70 || y > VIEW_H + 70) continue;
    ctx.beginPath();
    ctx.moveTo(x + stone.points[0].x, y + stone.points[0].y);
    for (let i = 1; i < stone.points.length; i += 1) {
      ctx.lineTo(x + stone.points[i].x, y + stone.points[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = COLOURS.stone;
    ctx.fill();
    ctx.strokeStyle = COLOURS.stoneDark;
    ctx.lineWidth = 3;
    ctx.stroke();
    // A pale top edge so stones read as solid rock.
    ctx.beginPath();
    ctx.moveTo(x + stone.points[0].x, y + stone.points[0].y);
    ctx.lineTo(x + stone.points[1].x, y + stone.points[1].y);
    ctx.lineTo(x + stone.points[2].x, y + stone.points[2].y);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawWaterAndBuds(ctx, world, camera, time) {
  for (const water of world.waters) {
    if (water.taken) continue;
    const x = water.x - camera.x;
    const y = water.y - camera.y;
    if (x < -20 || x > VIEW_W + 20 || y < -20 || y > VIEW_H + 20) continue;
    const bob = Math.sin(time * 2 + water.phase) * 3;
    const glow = 0.5 + 0.35 * Math.sin(time * 3 + water.phase);
    ctx.save();
    ctx.globalAlpha = 0.35 + glow * 0.4;
    ctx.fillStyle = COLOURS.water;
    ctx.beginPath();
    ctx.arc(x, y + bob, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Teardrop.
    ctx.fillStyle = COLOURS.water;
    ctx.beginPath();
    ctx.moveTo(x, y + bob - 12);
    ctx.quadraticCurveTo(x + 9, y + bob + 2, x, y + bob + 10);
    ctx.quadraticCurveTo(x - 9, y + bob + 2, x, y + bob - 12);
    ctx.fill();
    ctx.fillStyle = COLOURS.waterCore;
    ctx.beginPath();
    ctx.arc(x - 3, y + bob - 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const bud of world.buds) {
    if (bud.taken) continue;
    const x = bud.x - camera.x;
    const y = bud.y - camera.y;
    if (x < -20 || x > VIEW_W + 20 || y < -20 || y > VIEW_H + 20) continue;
    const pulse = 1 + 0.12 * Math.sin(time * 2.5 + bud.phase);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = COLOURS.rootGlow;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.quadraticCurveTo(0, -4, -8, -10);
    ctx.moveTo(0, 8);
    ctx.quadraticCurveTo(0, -4, 8, -10);
    ctx.stroke();
    ctx.fillStyle = COLOURS.rootGold;
    ctx.beginPath();
    ctx.arc(0, -12, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawGrubs(ctx, world, camera, time) {
  for (const grub of world.grubs) {
    const x = grub.x - camera.x;
    const y = grub.y - camera.y;
    if (x < -30 || x > VIEW_W + 30 || y < -30 || y > VIEW_H + 30) continue;
    const wiggle = Math.sin(time * 6 + grub.phase) * 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(grub.angle);
    // Segmented body.
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = i === 0 ? COLOURS.grubDark : COLOURS.grub;
      ctx.beginPath();
      ctx.arc(-10 + i * 9 + wiggle * (i === 1 ? 1 : 0), 0, 8 - i, 0, Math.PI * 2);
      ctx.fill();
    }
    // Tiny legs.
    ctx.strokeStyle = COLOURS.grubDark;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(-8 + i * 8, 6);
      ctx.lineTo(-8 + i * 8, 11);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawHeart(ctx, world, camera, time) {
  const heart = world.heart;
  const x = heart.x - camera.x;
  const y = heart.y - camera.y;
  if (x < -heart.radius - 40 || x > VIEW_W + heart.radius + 40) return;
  if (y < -heart.radius - 40 || y > VIEW_H + heart.radius + 40) return;
  // A slow red pulse from the cracks.
  const pulse = 0.5 + 0.3 * Math.sin(time * 1.5);
  const gradient = ctx.createRadialGradient(x, y, 20, x, y, heart.radius + 30);
  gradient.addColorStop(0, `rgba(127,29,29,${0.35 + pulse * 0.3})`);
  gradient.addColorStop(1, 'rgba(127,29,29,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, heart.radius + 30, 0, Math.PI * 2);
  ctx.fill();
  // The rock mass: overlapping dark circles for a craggy edge.
  ctx.fillStyle = COLOURS.heartDark;
  ctx.beginPath();
  ctx.arc(x, y, heart.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLOURS.heart;
  ctx.beginPath();
  ctx.arc(x - 18, y - 14, heart.radius - 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, heart.radius - 2, 0, Math.PI * 2);
  ctx.stroke();
  // Veins: glowing gold cracks, grey once cracked.
  for (const vein of heart.veins) {
    const vx = vein.x - camera.x;
    const vy = vein.y - camera.y;
    const glow = vein.cracked ? 0 : 0.6 + 0.4 * Math.sin(time * 4 + vein.angle * 3);
    ctx.save();
    ctx.globalAlpha = vein.cracked ? 0.5 : 0.5 + glow * 0.5;
    ctx.fillStyle = vein.cracked ? COLOURS.veinCracked : COLOURS.vein;
    ctx.beginPath();
    ctx.arc(vx, vy, vein.cracked ? 14 : 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (!vein.cracked) {
      ctx.strokeStyle = COLOURS.vein;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(vx - 12, vy - 6);
      ctx.lineTo(vx + 4, vy + 2);
      ctx.lineTo(vx + 12, vy - 8);
      ctx.stroke();
    } else {
      // A cracked vein shows a dark cross.
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(vx - 8, vy - 8);
      ctx.lineTo(vx + 8, vy + 8);
      ctx.moveTo(vx + 8, vy - 8);
      ctx.lineTo(vx - 8, vy + 8);
      ctx.stroke();
    }
  }
  // Label above the heart.
  ctx.fillStyle = '#fecaca';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('THE STONE HEART', x, y - heart.radius - 18);
}

/** The root trail: a wide soft glow pass, then a bright tapering core. */
function drawTrail(ctx, points, camera, color, widthScale) {
  if (points.length < 2) return;
  const visible = [];
  for (const point of points) {
    const x = point.x - camera.x;
    const y = point.y - camera.y;
    if (x < -40 || x > VIEW_W + 40 || y < -40 || y > VIEW_H + 40) continue;
    visible.push({ x, y });
  }
  if (visible.length < 2) return;
  // Glow pass.
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 16 * widthScale;
  ctx.beginPath();
  ctx.moveTo(visible[0].x, visible[0].y);
  for (let i = 1; i < visible.length; i += 1) ctx.lineTo(visible[i].x, visible[i].y);
  ctx.stroke();
  // Core pass, tapering from the oldest point to the tip.
  ctx.globalAlpha = 0.95;
  const segments = Math.min(visible.length - 1, 400);
  const start = visible.length - 1 - segments;
  for (let i = 0; i < segments; i += 1) {
    const a = visible[start + i];
    const b = visible[start + i + 1];
    const t = i / segments; // 0 at the tail, 1 at the tip
    ctx.strokeStyle = t > 0.85 ? COLOURS.rootCore : COLOURS.rootGlow;
    ctx.lineWidth = (2 + 7 * t) * widthScale;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

/** The growing tip: a bright head with a gold halo. */
function drawTip(ctx, root, camera, time) {
  const x = root.x - camera.x;
  const y = root.y - camera.y;
  if (x < -30 || x > VIEW_W + 30 || y < -30 || y > VIEW_H + 30) return;
  const blink = root.invulnUntil > 0 && Math.floor(time * 12) % 2 === 0;
  ctx.save();
  ctx.globalAlpha = blink ? 0.4 : 1;
  const halo = ctx.createRadialGradient(x, y, 2, x, y, 30);
  halo.addColorStop(0, 'rgba(184,245,61,0.55)');
  halo.addColorStop(1, 'rgba(184,245,61,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLOURS.rootCore;
  ctx.beginPath();
  ctx.arc(x, y, TIP_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLOURS.rootGold;
  ctx.beginPath();
  ctx.arc(x + 2, y - 2, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles(ctx, particles, camera) {
  for (const p of particles) {
    const x = p.x - camera.x;
    const y = p.y - camera.y;
    if (x < -10 || x > VIEW_W + 10 || y < -10 || y > VIEW_H + 10) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(x, y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/** The whole world, in world coordinates shifted by the camera. */
export function drawWorld(ctx, game, camera, time) {
  const { world, root, particles } = game;
  drawSoil(ctx, world, camera);
  drawStones(ctx, world, camera);
  drawWaterAndBuds(ctx, world, camera, time);
  drawGrubs(ctx, world, camera, time);
  drawHeart(ctx, world, camera, time);
  for (const branch of root.branches) {
    drawTrail(ctx, branch.trail, camera, COLOURS.rootGold, 0.7);
  }
  drawTrail(ctx, root.trail, camera, COLOURS.rootGlow, 1);
  drawTip(ctx, root, camera, time);
  drawParticles(ctx, particles, camera);
}

/** The HUD: depth meter, depth name, water, health, score, burst meter. */
export function drawHUD(ctx, game) {
  const { root, world } = game;
  const depth = depthAt(root.y);
  const depthName = DEPTHS[depth].name;

  // Top bar.
  ctx.fillStyle = 'rgba(12,10,9,0.72)';
  ctx.fillRect(0, 0, VIEW_W, 64);
  ctx.fillStyle = COLOURS.text;
  ctx.textAlign = 'left';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText(`ROOTBOUND`, 20, 42);
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = COLOURS.rootGold;
  ctx.fillText(`${depthName}  ·  Depth ${depth + 1} of 7`, 230, 40);

  ctx.textAlign = 'right';
  ctx.fillStyle = COLOURS.text;
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(`Score ${root.score}`, VIEW_W - 20, 40);

  // Second row: water, health, burst.
  ctx.textAlign = 'left';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillStyle = COLOURS.water;
  ctx.fillText(`💧 Water ${root.water}`, 20, 96);
  ctx.fillStyle = COLOURS.text;
  ctx.fillText(`Length ${Math.floor(root.length)} m`, 190, 96);

  // Health bar.
  const barX = 380;
  const barW = 260;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(barX, 80, barW, 20);
  ctx.fillStyle = root.health > 30 ? COLOURS.rootGlow : '#ef4444';
  ctx.fillRect(barX, 80, barW * (root.health / 100), 20);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, 80, barW, 20);
  ctx.fillStyle = COLOURS.text;
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText('Health', barX, 72);

  // Burst meter.
  const burstX = 680;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(burstX, 80, 160, 20);
  ctx.fillStyle = root.bursting ? COLOURS.rootGold : COLOURS.water;
  ctx.fillRect(burstX, 80, 160 * (root.burst / 100), 20);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.strokeRect(burstX, 80, 160, 20);
  ctx.fillStyle = COLOURS.text;
  ctx.fillText('Burst [Space]', burstX, 72);

  // Veins cracked (only matters near the heart, but always visible).
  ctx.textAlign = 'right';
  ctx.fillStyle = root.veinsCracked > 0 ? COLOURS.vein : COLOURS.dim;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`Heart veins ${root.veinsCracked}/${world.heart.veins.length}`, VIEW_W - 20, 96);

  // Depth meter: seven segments down the left edge, tip marker on it.
  const meterX = 14;
  const meterTop = 140;
  const meterH = 420;
  const segH = meterH / DEPTHS.length;
  for (let d = 0; d < DEPTHS.length; d += 1) {
    ctx.fillStyle = d === depth ? 'rgba(184,245,61,0.85)' : 'rgba(255,255,255,0.22)';
    ctx.fillRect(meterX, meterTop + d * segH, 10, segH - 3);
  }
  const markerY = meterTop + (root.y / WORLD_BOTTOM) * meterH;
  ctx.fillStyle = COLOURS.rootCore;
  ctx.beginPath();
  ctx.arc(meterX + 5, markerY, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Mute hint, bottom right.
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(245,245,220,0.6)';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('M mute · P pause', VIEW_W - 16, VIEW_H - 14);
}
