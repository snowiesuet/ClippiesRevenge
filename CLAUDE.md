# Clippy's Revenge - Clippy Full Clip

## Project Overview
Retro 2D arcade browser game built with Phaser 3. Clippy navigates through Windows eras (95 → XP → Vista) across multiple levels, each with a different game mechanic. Windows nostalgia aesthetic throughout.

## Tech Stack
- **Engine**: Phaser 3.60.0 (CDN, no npm dependency)
- **Language**: Vanilla JavaScript (ES6 modules)
- **Fonts**: Perfect DOS VGA 437 (retro DOS), Inconsolata (fallback)
- **Hosting**: Vercel (static site)
- **Dev server**: `npm start` → http-server on port 3000

## Architecture
- `index.html` — Entry point, loads Phaser CDN + `src/game.js` as module
- `src/game.js` — Phaser config, registers all scenes
- `src/intro.js` — DOS boot screen intro (IntroScene)
- `src/level1.js` — Level 1: Donkey Kong platformer (Level1Scene)
- `src/level2.js` — Level 2: Side-scrolling shoot 'em up (Level2Scene)
- `assets/img/` — All sprites/backgrounds (clippy.png, wins95-bg.png, icons/)
- `plan/` — Game design docs and level sketches (game_plan.md.txt, lvl1-3.png)

## Scene Pattern
All scenes follow this structure:
```js
class MyScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MyScene' });
        // Constants and state here
    }
    preload() { /* load assets */ }
    create() { /* setup game objects, input, timers, collisions, resize handler */ }
    update() { /* per-frame: movement, cleanup, checks */ }
}
export default MyScene;
```

Adding a new scene:
1. Create `src/levelN.js` with the scene class
2. Import in `src/game.js` and add to `scene: [...]` array
3. Transition via `this.scene.start('SceneKey')` from previous scene

## Game Levels (from plan/game_plan.md.txt)

| Level | Windows Era | Mechanic | Status |
|-------|------------|----------|--------|
| 1 | Windows 95 | Donkey Kong platformer — climb to Recycle Bin | Built (no win condition yet) |
| 2 | XP Recycle Bin | Side-scrolling shmup — 6 waves, auto-fire, corruption FX | Built (placeholder art) |
| 3 | XP → LimeWire → BSOD | Typing racer — 70 WPM to beat Gill Bates | Not started |
| 4 | Windows Vista | Find the missing Start button | Not started |

## Key Constants Pattern
All tuning values (speeds, sizes, spawn rates, colors) are defined in the scene constructor for easy tweaking. No magic numbers in methods.

## Current State
- **intro.js** is temporarily set to `this.scene.start('Level2Scene')` for testing. Revert to `'Level1Scene'` when done.
- Level 1 has NO win condition — needs: reach top level → enter recycle bin → transition to Level2Scene
- Level 2 uses placeholder shapes (colored rectangles/circles). Real art TBD.
- Level 2 win portal currently restarts (Level 3 doesn't exist yet)

## Common Phaser Patterns Used
- Physics groups: `this.physics.add.group({ allowGravity: false })`
- Collision: `this.physics.add.overlap(a, b, callback, undefined, this)`
- Timed spawns: `this.time.addEvent({ delay, loop, callback, callbackScope })`
- Placeholders: `this.add.rectangle()` / `this.add.circle()` + `this.physics.add.existing()`
- Animations: `this.tweens.add({ targets, ... })`
- Resize: `this.scale.on('resize', () => { ... })`
