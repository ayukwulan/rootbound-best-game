# ROOTBOUND

[![make.fun](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![make.fun rank](https://make.fun/badge/best-game-01/ayukwulan/rootbound-best-game/rank.svg)](https://make.fun/bounty/best-game-01)
[![make.fun reward](https://make.fun/badge/best-game-01/ayukwulan/rootbound-best-game/reward.svg)](https://make.fun/bounty/best-game-01)

Grow a living root through seven depths — drink deep water, split around stone, bloom against the Stone Heart.

## The game

You steer a growing root tip through the earth. The root grows on its own; you steer it with the mouse or WASD / arrow keys. Drink water droplets to grow longer and score. Stone costs health. Grubs nibble the root. A branch bud splits off a second tip that hunts water on its own. Space is a deep-tap burst.

Seven named depths — Topsoil, Clay, Gravel, Sand, Chalk, Bedrock, The Deep — each with its own soil and hazard density. At the bottom waits the Stone Heart, a rock mass with three glowing weak veins. Crack all three to bloom and win. If your health hits zero, the root withers.

- **Goal:** crack the Stone Heart's 3 veins and bloom. **Lose:** health reaches zero.
- **Score:** water × 10, depth × 25, veins × 150, win bonus 500, plus a time bonus.
- **Controls:** mouse steer (primary), WASD / arrows, Space to burst, P pause, M mute, Enter to start / restart.
- **Sound:** synthesised WebAudio only — no sound files.
- **Tech:** plain 2D canvas, no library, no network request, works offline.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## Screenshots

The four screenshots in `screenshots/` are real renders of the game's own code, staged deterministically with `?shot=start|play|boss|end&seed=1`:

```sh
node capture.mjs   # writes screenshots/1-start.jpg … 4-end.jpg
node playtest.mjs  # pure-logic checks + a real browser drive
```

## Layout

- `game/index.html` — the page; the canvas and nothing else.
- `game/src/config.js` — every tuning number and the seven depths.
- `game/src/random.js` — seeded randomness (same seed, same earth).
- `game/src/world.js` — terrain generation, stones, water, buds, grubs, the Stone Heart, collision.
- `game/src/root.js` — the growing root, steering, branch tips, health and score.
- `game/src/enemies.js` — grub wandering and nibbling.
- `game/src/audio.js` — synthesised WebAudio effects.
- `game/src/input.js` — mouse + keyboard steering and action keys.
- `game/src/render.js` — the soil, the glowing root, entities, particles and the HUD.
- `game/src/ui.js` — title, pause, win and loss screens.
- `game/src/shots.js` — deterministic screenshot staging with an autopilot.
- `game/src/main.js` — the state machine, the fixed-step loop, the wiring.
- `main.ts` — hands the game in: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.

Built for the make.fun bounty [best-game-01](https://make.fun/bounty/best-game-01) — "Make the best game".
