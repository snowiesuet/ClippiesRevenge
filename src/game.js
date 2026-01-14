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
const LEVEL_SLANT = 30; // pixels of vertical offset for slant effect
const LADDER_WIDTH = 16;
const LADDER_HEIGHT = 48;
const LADDER_COLOR = 0x00ff00;
let ladders = [];
let isJumping = false;
let spaceKey;
const JUMP_HEIGHT = 48; // pixels
const JUMP_DURATION = 300; // ms total up+down
// Obstacles
let obstacles;
const OBSTACLE_SIZE = 20;
const OBSTACLE_SPEED_MIN = 80;
const OBSTACLE_SPEED_MAX = 160;
const OBSTACLE_SPAWN_MS = 1200;
let obstacleTimer;
let obstacleImages = [];
const OBSTACLE_IMAGE_DIR = 'assets/img/icons/';
// Spawn multiple obstacles per tick
const OBSTACLE_SPAWN_COUNT_MIN = 1;
const OBSTACLE_SPAWN_COUNT_MAX = 3;
// Speed increase per level closer to the top
const OBSTACLE_SPEED_PER_LEVEL = 20;

const game = new Phaser.Game(config);

function preload() {
    // load a PNG for the player; using a small placeholder image URL
    this.load.image('playerImg', 'https://static.wikia.nocookie.net/central/images/c/cb/Clippy.png');
    // background image (replace with local asset if preferred)
    this.load.image('bg', 'https://static0.howtogeekimages.com/wordpress/wp-content/uploads/2024/06/windows-95.jpg');

    // Try to load obstacle images from assets/img/icons folder
    // This is a basic approach - load common icon names
    const possibleIcons = [
        'desktop1', 'desktop2', 'desktop3', 'desktop4'
    ];

    possibleIcons.forEach(name => {
        const path = OBSTACLE_IMAGE_DIR + name + '.png';
        // Use onFileComplete to track successful loads
        this.load.image(name, path);
    });

    // Listen for file load errors and populate obstacleImages with what actually loaded
    this.load.on('filecomplete', (key) => {
        if (possibleIcons.includes(key)) {
            obstacleImages.push(key);
        }
    });
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

    // Spacebar to jump (hop on current level)
    spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard.on('keydown-SPACE', () => {
        if (!isJumping) {
            isJumping = true;
            const startY = LEVEL_HEIGHTS[currentLevel];
            this.tweens.add({
                targets: player,
                y: startY - JUMP_HEIGHT,
                duration: JUMP_DURATION / 2,
                ease: 'Quad.easeOut',
                yoyo: true,
                onComplete: () => {
                    player.y = LEVEL_HEIGHTS[currentLevel];
                    isJumping = false;
                }
            });
        }
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

    // Obstacles group and collision
    obstacles = this.physics.add.group({ allowGravity: false, immovable: true });
    this.physics.add.overlap(player, obstacles, handleObstacleHit, undefined, this);

    // Spawn obstacles periodically
    obstacleTimer = this.time.addEvent({ delay: OBSTACLE_SPAWN_MS, loop: true, callback: spawnObstacleBatch, callbackScope: this });
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
        // Alternate slant direction for each level
        const slant = (i % 2 === 0) ? LEVEL_SLANT : -LEVEL_SLANT;
        const line = this.add.line(0, LEVEL_HEIGHTS[i], 0, 0, width, slant, LEVEL_LINE_COLOR)
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

function spawnObstacleBatch() {
    const count = Phaser.Math.Between(OBSTACLE_SPAWN_COUNT_MIN, OBSTACLE_SPAWN_COUNT_MAX);
    for (let i = 0; i < count; i++) {
        spawnObstacle.call(this);
    }
}

function pickWeightedLevel() {
    // Higher levels (closer to top) have higher weight
    // Bottom level gets the smallest weight
    let total = 0;
    const weights = [];
    for (let i = 0; i < NUM_LEVELS; i++) {
        const w = (NUM_LEVELS - 1 - i) + 1; // top: NUM_LEVELS, bottom: 1
        weights.push(w);
        total += w;
    }
    let r = Phaser.Math.Between(1, total);
    for (let i = 0; i < NUM_LEVELS; i++) {
        r -= weights[i];
        if (r <= 0) return i;
    }
    return NUM_LEVELS - 1; // fallback to bottom
}

function spawnObstacle() {
    const width = this.sys.game.canvas.width;
    // Pick a random level to spawn on
    const lvl = pickWeightedLevel();
    const y = LEVEL_HEIGHTS[lvl];
    // Choose side: 0 left, 1 right
    const side = Phaser.Math.Between(0, 1);
    // Speed scales up for higher levels (top is fastest)
    const levelBoost = (NUM_LEVELS - 1 - lvl) * OBSTACLE_SPEED_PER_LEVEL;
    const speed = Phaser.Math.Between(OBSTACLE_SPEED_MIN + levelBoost, OBSTACLE_SPEED_MAX + levelBoost);
    const x = side === 0 ? -OBSTACLE_SIZE : width + OBSTACLE_SIZE;

    // Pick a random obstacle image if available, otherwise fallback to red rectangle
    let obstacle;
    if (obstacleImages.length > 0) {
        const randomImage = obstacleImages[Math.floor(Math.random() * obstacleImages.length)];
        obstacle = this.add.sprite(x, y, randomImage).setOrigin(0.5, 1).setDisplaySize(OBSTACLE_SIZE, OBSTACLE_SIZE);
    } else {
        obstacle = this.add.rectangle(x, y, OBSTACLE_SIZE, OBSTACLE_SIZE, 0xff4444).setOrigin(0.5, 1);
    }

    // Use dynamic physics body so velocity moves the obstacle
    this.physics.add.existing(obstacle);
    obstacles.add(obstacle);
    // Move across the screen
    const vx = side === 0 ? speed : -speed;
    obstacle.body.setAllowGravity(false);
    obstacle.body.setImmovable(true);
    obstacle.setDepth(10);
    obstacle.body.setVelocityX(vx);
}

function handleObstacleHit(playerObj, obstacleObj) {
    // Simple feedback: tint and reset to bottom-left
    playerObj.setTint(0xff0000);
    this.time.delayedCall(200, () => playerObj.clearTint());
    currentLevel = NUM_LEVELS - 1;
    playerObj.x = PLAYER_SIZE / 2;
    playerObj.y = LEVEL_HEIGHTS[currentLevel];
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
    if (!isJumping) {
        player.y = LEVEL_HEIGHTS[currentLevel];
    }

    // Prevent player from moving off ladder X when on a ladder (if not moving horizontally)
    if (isOnLadder(player.x, currentLevel)) {
        // Optionally snap to ladder X if very close
        if (Math.abs(player.x - ladders[currentLevel].x) < 2) {
            player.x = ladders[currentLevel].x;
        }
    }

    // Remove off-screen obstacles
    const width = this.sys.game.canvas.width;
    obstacles.children.iterate((obs) => {
        if (!obs) return;
        const x = obs.x;
        if (x < -OBSTACLE_SIZE * 2 || x > width + OBSTACLE_SIZE * 2) {
            obs.destroy();
        }
    });
}
