// Phaser 3 version: 2D game with WASD movement
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
    scene: {
        preload: preload,
        create: create,
        update: update
    },
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
};


const NUM_LEVELS = 5;

let player;
let cursors;
let currentLevel = NUM_LEVELS - 1; // Start at bottom line (0-indexed)
const LEVEL_HEIGHTS = [];
const PLAYER_SIZE = 32;
const PLAYER_SPEED = 200;
const LEVEL_LINE_COLOR = 0xffffff;
const LEVEL_LINE_WIDTH = 2;
const LADDER_WIDTH = 16;
const LADDER_HEIGHT = 48;
const LADDER_COLOR = 0x00ff00;
let ladders = [];

const game = new Phaser.Game(config);

function preload() {
    // load a PNG for the player; using a small placeholder image URL
    this.load.image('playerImg', 'https://static.wikia.nocookie.net/central/images/c/cb/Clippy.png');
    // background image (replace with local asset if preferred)
    this.load.image('bg', 'https://static0.howtogeekimages.com/wordpress/wp-content/uploads/2024/06/windows-95.jpg');
}


function create() {
    drawLevelAndLadders.call(this);

    // Create player sprite ON the line (bottom of sprite sits on the line), at the bottom left
    player = this.physics.add.sprite(PLAYER_SIZE / 2, LEVEL_HEIGHTS[currentLevel], 'playerImg');
    player.setOrigin(0.5, 1); // anchor bottom center
    player.setDisplaySize(PLAYER_SIZE, PLAYER_SIZE);
    player.body.setCollideWorldBounds(true);
    player.body.setImmovable(true);

    // WASD keys
    cursors = this.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D
    });

    // Prevent holding W/S from skipping multiple levels, only if at ladder
    this.input.keyboard.on('keydown-W', () => {
        if (currentLevel > 0 && isOnLadder(player.x, currentLevel)) {
            // Store the X position of the current ladder before moving up
            const currentLadderX = ladders[currentLevel].x;
            currentLevel--;
            player.y = LEVEL_HEIGHTS[currentLevel];
            // Start player at the same side as the ladder they just climbed from
            player.x = currentLadderX;
        }
    });
    this.input.keyboard.on('keydown-S', () => {
        if (currentLevel < NUM_LEVELS - 1 && isOnLadder(player.x, currentLevel)) {
            // Store the X position of the current ladder before moving down
            const currentLadderX = ladders[currentLevel].x;
            currentLevel++;
            player.y = LEVEL_HEIGHTS[currentLevel];
            // Start player at the same side as the ladder they just climbed from
            player.x = currentLadderX;
        }
    });

    // Redraw lines/ladders on resize
    this.scale.on('resize', () => {
        drawLevelAndLadders.call(this);
        player.y = LEVEL_HEIGHTS[currentLevel];
        // Snap player to left or right if on a ladder
        snapToLadder(player, currentLevel);
    });
}

function drawLevelAndLadders() {
    // Remove old lines/ladders if any
    if (this.levelGraphics) {
        this.levelGraphics.forEach(obj => obj.destroy());
    }
    this.levelGraphics = [];
    // Use the actual rendered canvas size for 100% width/height
    const width = this.sys.game.canvas.width;
    const height = this.sys.game.canvas.height;
    // Add background image, stretch to fit
    if (this.bgImg) this.bgImg.destroy();
    this.bgImg = this.add.image(width / 2, height / 2, 'bg').setDisplaySize(width, height);

    // Calculate Y positions for each level (evenly spaced, ON the line)
    const spacing = (height - 0) / (NUM_LEVELS - 1);
    ladders = [];
    for (let i = 0; i < NUM_LEVELS; i++) {
        LEVEL_HEIGHTS[i] = Math.round(i * spacing);
        // Draw horizontal line for each level, always spanning 100% of the visible screen
        // Draw line from (0, LEVEL_HEIGHTS[i]) to (width, LEVEL_HEIGHTS[i])
        const line = this.add.line(0, LEVEL_HEIGHTS[i], 0, 0, width, 0, LEVEL_LINE_COLOR)
            .setOrigin(0, 0)
            .setLineWidth(LEVEL_LINE_WIDTH);
        this.levelGraphics.push(line);
        // Place ladder: bottom level is right, next is left, next is right, etc.
        let ladderX = ((NUM_LEVELS - 1 - i) % 2 === 0) ? (width - LADDER_WIDTH / 2) : (LADDER_WIDTH / 2);
        let ladder = this.add.rectangle(ladderX, LEVEL_HEIGHTS[i], LADDER_WIDTH, LADDER_HEIGHT, LADDER_COLOR).setOrigin(0.5, 1);
        this.physics.add.existing(ladder, true);
        this.levelGraphics.push(ladder);
        ladders.push(ladder);
    }
}

function isOnLadder(px, level) {
    // Player must be close to the ladder X position for this level
    const ladderX = ladders[level].x;
    return Math.abs(px - ladderX) < LADDER_WIDTH;
}

function snapToLadder(player, level) {
    // Snap player X to ladder X
    player.x = ladders[level].x;
}


function update() {
    player.body.setVelocity(0);

    // Only allow left/right movement, snap Y to current level (bottom of sprite on line)
    if (cursors.left.isDown) {
        player.body.setVelocityX(-PLAYER_SPEED);
    } else if (cursors.right.isDown) {
        player.body.setVelocityX(PLAYER_SPEED);
    }
    player.y = LEVEL_HEIGHTS[currentLevel];

    // Prevent player from moving off ladder X when on a ladder (if not moving horizontally)
    if (isOnLadder(player.x, currentLevel)) {
        // Optionally snap to ladder X if very close
        if (Math.abs(player.x - ladders[currentLevel].x) < 2) {
            player.x = ladders[currentLevel].x;
        }
    }
}
