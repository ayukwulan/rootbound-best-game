// Screens: title, pause, win and loss. Drawn on the canvas so the
// screenshots show the whole loop, and clickable by canvas coordinates.
// Each screen returns the buttons it draws, for hit-testing.
import { VIEW_W, VIEW_H, COLOURS, DEPTHS } from './config.js';

/** Centre a block of title text. Returns the primary button rect. */
function titleBlock(ctx, lines, accent) {
  ctx.fillStyle = 'rgba(10,8,6,0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  let y = 170;
  for (const line of lines) {
    ctx.fillStyle = line.color || COLOURS.text;
    ctx.font = line.font;
    ctx.textAlign = 'center';
    ctx.fillText(line.text, VIEW_W / 2, y);
    y += line.gap;
  }
  return y;
}

/** A rounded button; returns its rect for hit-testing. */
export function drawButton(ctx, x, y, w, h, label, hot) {
  ctx.save();
  ctx.fillStyle = hot ? '#65a30d' : '#3f6212';
  ctx.strokeStyle = COLOURS.rootCore;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f7fee7';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 9);
  ctx.restore();
  return { x, y, w, h, label };
}

/** The title screen. Returns { buttons: [...] }. */
export function drawTitle(ctx, best) {
  // A soft glow behind the title, like light through soil.
  const glow = ctx.createRadialGradient(VIEW_W / 2, 220, 20, VIEW_W / 2, 220, 420);
  glow.addColorStop(0, 'rgba(74,222,128,0.20)');
  glow.addColorStop(1, 'rgba(74,222,128,0)');
  ctx.fillStyle = '#171008';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  const after = titleBlock(ctx, [
    { text: 'ROOTBOUND', font: 'bold 96px system-ui, sans-serif', color: COLOURS.rootCore, gap: 110 },
    { text: 'Grow a living root through seven depths.', font: 'bold 30px system-ui, sans-serif', gap: 44 },
    { text: 'Drink deep water. Split around stone. Bloom against the Stone Heart.', font: '24px system-ui, sans-serif', color: COLOURS.dim, gap: 60 },
    { text: 'Mouse or WASD / arrows to steer  ·  Space to burst  ·  M to mute', font: 'bold 22px system-ui, sans-serif', color: COLOURS.water, gap: 50 },
    { text: 'Water grows you. Stone and grubs hurt you. Crack the 3 gold veins to win.', font: '20px system-ui, sans-serif', color: COLOURS.dim, gap: 80 },
  ]);
  const buttons = [];
  buttons.push(drawButton(ctx, VIEW_W / 2 - 170, after, 340, 62, '▶  START GROWING', true));
  if (best > 0) {
    ctx.fillStyle = COLOURS.dim;
    ctx.font = '20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Best score: ${best}`, VIEW_W / 2, after + 100);
  }
  // The seven depths, as a promise of the journey.
  ctx.fillStyle = COLOURS.dim;
  ctx.font = '18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(DEPTHS.map(d => d.name).join('  →  '), VIEW_W / 2, VIEW_H - 40);
  return { buttons };
}

/** The pause screen. */
export function drawPause(ctx) {
  const after = titleBlock(ctx, [
    { text: 'PAUSED', font: 'bold 72px system-ui, sans-serif', color: COLOURS.text, gap: 100 },
    { text: 'The root waits in the dark.', font: '24px system-ui, sans-serif', color: COLOURS.dim, gap: 70 },
  ]);
  const buttons = [];
  buttons.push(drawButton(ctx, VIEW_W / 2 - 170, after, 340, 62, '▶  RESUME', true));
  buttons.push(drawButton(ctx, VIEW_W / 2 - 170, after + 78, 340, 62, '↺  RESTART', false));
  return { buttons };
}

/** The win screen: bloom, score breakdown, restart. */
export function drawWin(ctx, game) {
  const { root } = game;
  const seconds = Math.max(1, Math.floor(game.elapsed));
  const timeBonus = Math.max(0, 600 - seconds) * 2;
  const total = root.score + timeBonus;
  const after = titleBlock(ctx, [
    { text: '🌸  BLOOM!', font: 'bold 84px system-ui, sans-serif', color: COLOURS.bloom, gap: 100 },
    { text: 'The root cracked the Stone Heart and bloomed in the Deep.', font: '28px system-ui, sans-serif', gap: 56 },
    { text: `Water ${root.water}  ·  Length ${Math.floor(root.length)} m  ·  Depths ${root.maxDepth + 1} of 7`, font: 'bold 24px system-ui, sans-serif', color: COLOURS.text, gap: 44 },
    { text: `Score ${root.score}  +  time bonus ${timeBonus}  =  ${total}`, font: 'bold 28px system-ui, sans-serif', color: COLOURS.rootGold, gap: 80 },
  ]);
  const buttons = [];
  buttons.push(drawButton(ctx, VIEW_W / 2 - 170, after, 340, 62, '↺  GROW AGAIN', true));
  return { buttons, total };
}

/** The loss screen: withered, score, restart. */
export function drawLose(ctx, game) {
  const { root } = game;
  const after = titleBlock(ctx, [
    { text: 'THE ROOT WITHERED', font: 'bold 64px system-ui, sans-serif', color: '#fca5a5', gap: 90 },
    { text: `It reached ${DEPTHS[Math.min(root.maxDepth, 6)].name} — ${Math.floor(root.length)} m grown, ${root.water} water drunk.`, font: '26px system-ui, sans-serif', gap: 56 },
    { text: `Score ${root.score}`, font: 'bold 28px system-ui, sans-serif', color: COLOURS.rootGold, gap: 80 },
  ]);
  const buttons = [];
  buttons.push(drawButton(ctx, VIEW_W / 2 - 170, after, 340, 62, '↺  TRY AGAIN', true));
  return { buttons };
}

/** True when a canvas point falls inside a button rect. */
export function hitButton(buttons, x, y) {
  for (const button of buttons) {
    if (x >= button.x && x <= button.x + button.w && y >= button.y && y <= button.y + button.h) {
      return button.label;
    }
  }
  return null;
}
