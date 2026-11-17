// ROOTBOUND tuning and world constants. One place for every number the
// game balances on, so a tuning pass touches this file and nothing else.
export const VIEW_W = 1280;
export const VIEW_H = 800;
export const STEP = 1 / 60;

// The earth is wider than the screen; the camera follows the tip sideways
// so the root stays near the centre of the frame.
export const WORLD_W = 1680;

// The root tip advances on its own; the player only steers it.
export const TIP_SPEED = 150;
export const BURST_SPEED = 330;
export const BURST_DRAIN = 55; // burst meter per second while bursting
export const BURST_REGEN = 6; // burst meter per second, idle
export const TURN_RATE = 3.4; // radians per second toward the steering target
export const TIP_RADIUS = 9;
export const TRAIL_MAX = 1600; // points kept; older points fade out of the root
export const TRAIL_SPACING = 7; // px between stored trail points

// Health and score.
export const HEALTH_MAX = 100;
export const STONE_DAMAGE = 8;
export const GRUB_DAMAGE = 7;
export const WATER_HEAL = 2;
export const WATER_SCORE = 10;
export const VEIN_SCORE = 150;
export const WIN_BONUS = 500;
export const DEPTH_SCORE = 25; // per depth reached
export const INVULN_SECONDS = 0.9; // after taking a hit

// Seven depths. Each is a band of the earth with its own palette and
// hazard density; the deeper the band, the busier the ground.
export const DEPTH_HEIGHT = 1200;
export const DEPTHS = [
  { name: 'Topsoil', soil: '#3a2a1a', dark: '#241a10', stone: 0.5, water: 1.3, grubs: 1 },
  { name: 'Clay', soil: '#4a2f1d', dark: '#2d1c10', stone: 0.8, water: 1.1, grubs: 2 },
  { name: 'Gravel', soil: '#3d332a', dark: '#262019', stone: 1.1, water: 1.0, grubs: 2 },
  { name: 'Sand', soil: '#54401f', dark: '#332712', stone: 0.9, water: 1.2, grubs: 3 },
  { name: 'Chalk', soil: '#4c4636', dark: '#2e2a20', stone: 1.3, water: 0.9, grubs: 3 },
  { name: 'Bedrock', soil: '#2e2a2e', dark: '#1b191b', stone: 1.6, water: 0.8, grubs: 4 },
  { name: 'The Deep', soil: '#1e1410', dark: '#120c08', stone: 1.2, water: 1.0, grubs: 5 },
];
export const BOSS_Y = DEPTHS.length * DEPTH_HEIGHT + 600; // Stone Heart centre
export const WORLD_BOTTOM = BOSS_Y + 500;

// The Stone Heart: a rock mass the root must grow around. Three glowing
// weak veins on its upper face; crack all three to bloom and win.
export const HEART_RADIUS = 210;
export const HEART_VEINS = 3;
export const VEIN_RADIUS = 26;

// Grubs: root-eating larvae that wander the soil and nibble the trail.
export const GRUB_SPEED = 42;
export const GRUB_RADIUS = 13;
export const GRUB_NIBBLE_SECONDS = 0.6; // between nibbles on the same grub

// Water droplets drift almost still; a branch bud splits a second tip.
export const WATER_RADIUS = 11;
export const BUD_RADIUS = 15;
export const BRANCH_MAX = 2; // extra autopilot tips at once
export const BRANCH_LIFE = 25; // seconds before a branch tip withers

// Colours. Dark earth, glowing green/gold root, blue water.
export const COLOURS = {
  rootCore: '#b8f53d',
  rootGlow: '#4ade80',
  rootGold: '#fbbf24',
  water: '#38bdf8',
  waterCore: '#bae6fd',
  stone: '#6b7280',
  stoneDark: '#374151',
  grub: '#a16207',
  grubDark: '#713f12',
  heart: '#7f1d1d',
  heartDark: '#450a0a',
  vein: '#fbbf24',
  veinCracked: '#57534e',
  bloom: '#f472b6',
  text: '#f5f5dc',
  dim: '#a8a29e',
};
