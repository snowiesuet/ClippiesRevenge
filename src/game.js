// Phaser 3 Game - Clippie's Revenge
// Main game initialization

import IntroScene from './intro.js';
import Level1Scene from './level1.js';
import Level2Scene from './level2.js';

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#444',
    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            debug: false
        }
    },
    scene: [Level2Scene], // Start with intro, then level 1, then level 2
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};

const game = new Phaser.Game(config);
