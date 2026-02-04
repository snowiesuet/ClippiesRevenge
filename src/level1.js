// Level 1 Gameplay Scene
class Level1Scene extends Phaser.Scene {
    constructor() {
        super({ key: 'Level1Scene' });

        // Constants
        this.NUM_LEVELS = 5;
        this.PLAYER_SIZE = 50;
        this.PLAYER_SPEED = 200;
        this.LEVEL_LINE_COLOR = 0xffffff;
        this.LEVEL_LINE_WIDTH = 2;
        this.LEVEL_SLANT = 30;
        this.LADDER_WIDTH = 60;
        this.LADDER_HEIGHT = 60;
        this.LADDER_COLOR = 0x00ff00;
        this.JUMP_HEIGHT = 80; // Higher jump to reliably clear obstacles
        this.JUMP_DURATION = 300;
        this.OBSTACLE_SIZE = 30;
        this.OBSTACLE_SPEED_MIN = 80;
        this.OBSTACLE_SPEED_MAX = 160;
        this.OBSTACLE_SPAWN_MS = 1200;
        this.OBSTACLE_IMAGE_DIR = 'assets/img/icons/';
        this.OBSTACLE_SPAWN_COUNT_MIN = 1;
        this.OBSTACLE_SPAWN_COUNT_MAX = 3;
        this.OBSTACLE_SPEED_PER_LEVEL = 20;

        // Game state
        this.player = null;
        this.cursors = null;
        this.currentLevel = this.NUM_LEVELS - 1;
        this.LEVEL_HEIGHTS = [];
        this.ladders = [];
        this.isJumping = false;
        this.spaceKey = null;
        this.obstacles = null;
        this.obstacleTimer = null;
        this.obstacleImages = [];
    }

    preload() {
        // load a PNG for the player
        this.load.image('playerImg', 'assets/img/clippy.png');
        // background image
        this.load.image('bg', 'assets/img/wins95-bg.png');

        // Try to load obstacle images from assets/img/icons folder
        const possibleIcons = [
            'desktop1', 'desktop2', 'desktop3', 'desktop4'
        ];

        possibleIcons.forEach(name => {
            const path = this.OBSTACLE_IMAGE_DIR + name + '.png';
            this.load.image(name, path);
        });

        // Listen for file load and populate obstacleImages with what actually loaded
        this.load.on('filecomplete', (key) => {
            if (possibleIcons.includes(key)) {
                this.obstacleImages.push(key);
            }
        });
    }

    create() {
        this.drawLevelAndLadders();

        // Create player sprite ON the line (bottom of sprite sits on the line), at the bottom left
        this.player = this.physics.add.sprite(this.PLAYER_SIZE / 2, this.LEVEL_HEIGHTS[this.currentLevel], 'playerImg');
        this.player.setOrigin(0.5, 1); // anchor bottom center
        this.player.setDisplaySize(this.PLAYER_SIZE, this.PLAYER_SIZE);
        this.player.body.setSize(this.PLAYER_SIZE * 0.8, this.PLAYER_SIZE * 0.8); // Tighter hitbox
        this.player.body.setCollideWorldBounds(true);
        this.player.body.setImmovable(true);

        // WASD keys
        this.cursors = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });

        // Spacebar to jump (hop on current level)
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.input.keyboard.on('keydown-SPACE', () => {
            if (!this.isJumping) {
                this.isJumping = true;
                const startY = this.LEVEL_HEIGHTS[this.currentLevel];
                this.tweens.add({
                    targets: this.player,
                    y: startY - this.JUMP_HEIGHT,
                    duration: this.JUMP_DURATION / 2,
                    ease: 'Quad.easeOut',
                    yoyo: true,
                    onComplete: () => {
                        this.player.y = this.LEVEL_HEIGHTS[this.currentLevel];
                        this.isJumping = false;
                    }
                });
            }
        });

        // Prevent holding W/S from skipping multiple levels, only if at ladder
        this.input.keyboard.on('keydown-W', () => {
            if (this.currentLevel > 0 && this.isOnLadder(this.player.x, this.currentLevel)) {
                // Store the X position of the current ladder before moving up
                const currentLadderX = this.ladders[this.currentLevel].x;
                this.currentLevel--;
                this.player.y = this.LEVEL_HEIGHTS[this.currentLevel];
                // Start player at the same side as the ladder they just climbed from
                this.player.x = currentLadderX;
            }
        });
        this.input.keyboard.on('keydown-S', () => {
            if (this.currentLevel < this.NUM_LEVELS - 1 && this.isOnLadder(this.player.x, this.currentLevel)) {
                // Store the X position of the current ladder before moving down
                const currentLadderX = this.ladders[this.currentLevel].x;
                this.currentLevel++;
                this.player.y = this.LEVEL_HEIGHTS[this.currentLevel];
                // Start player at the same side as the ladder they just climbed from
                this.player.x = currentLadderX;
            }
        });

        // Redraw lines/ladders on resize
        this.scale.on('resize', () => {
            this.drawLevelAndLadders();
            this.player.y = this.LEVEL_HEIGHTS[this.currentLevel];
            // Snap player to left or right if on a ladder
            this.snapToLadder(this.player, this.currentLevel);
        });

        // Obstacles group and collision
        this.obstacles = this.physics.add.group({ allowGravity: false, immovable: true });
        this.physics.add.overlap(this.player, this.obstacles, this.handleObstacleHit, undefined, this);

        // Spawn obstacles periodically
        this.obstacleTimer = this.time.addEvent({
            delay: this.OBSTACLE_SPAWN_MS,
            loop: true,
            callback: this.spawnObstacleBatch,
            callbackScope: this
        });
    }

    drawLevelAndLadders() {
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
        const spacing = (height - 0) / (this.NUM_LEVELS - 1);
        this.ladders = [];
        for (let i = 0; i < this.NUM_LEVELS; i++) {
            this.LEVEL_HEIGHTS[i] = Math.round(i * spacing);
            // Draw horizontal line for each level, always spanning 100% of the visible screen
            // Alternate slant direction for each level
            const slant = (i % 2 === 0) ? this.LEVEL_SLANT : -this.LEVEL_SLANT;
            const line = this.add.line(0, this.LEVEL_HEIGHTS[i], 0, 0, width, slant, this.LEVEL_LINE_COLOR)
                .setOrigin(0, 0)
                .setLineWidth(this.LEVEL_LINE_WIDTH);
            this.levelGraphics.push(line);
            // Place ladder: bottom level is right, next is left, next is right, etc.
            let ladderX = ((this.NUM_LEVELS - 1 - i) % 2 === 0) ? (width - this.LADDER_WIDTH / 2) : (this.LADDER_WIDTH / 2);
            let ladder = this.add.rectangle(ladderX, this.LEVEL_HEIGHTS[i], this.LADDER_WIDTH, this.LADDER_HEIGHT, this.LADDER_COLOR).setOrigin(0.5, 1);
            this.physics.add.existing(ladder, true);
            this.levelGraphics.push(ladder);
            this.ladders.push(ladder);
        }
    }

    spawnObstacleBatch() {
        const count = Phaser.Math.Between(this.OBSTACLE_SPAWN_COUNT_MIN, this.OBSTACLE_SPAWN_COUNT_MAX);
        for (let i = 0; i < count; i++) {
            this.spawnObstacle();
        }
    }

    pickWeightedLevel() {
        // Higher levels (closer to top) have higher weight
        // Bottom level gets the smallest weight
        let total = 0;
        const weights = [];
        for (let i = 0; i < this.NUM_LEVELS; i++) {
            const w = (this.NUM_LEVELS - 1 - i) + 1; // top: NUM_LEVELS, bottom: 1
            weights.push(w);
            total += w;
        }
        let r = Phaser.Math.Between(1, total);
        for (let i = 0; i < this.NUM_LEVELS; i++) {
            r -= weights[i];
            if (r <= 0) return i;
        }
        return this.NUM_LEVELS - 1; // fallback to bottom
    }

    spawnObstacle() {
        const width = this.sys.game.canvas.width;
        // Pick a random level to spawn on
        const lvl = this.pickWeightedLevel();
        const y = this.LEVEL_HEIGHTS[lvl];
        // Choose side: 0 left, 1 right
        const side = Phaser.Math.Between(0, 1);
        // Speed scales up for higher levels (top is fastest)
        const levelBoost = (this.NUM_LEVELS - 1 - lvl) * this.OBSTACLE_SPEED_PER_LEVEL;
        const speed = Phaser.Math.Between(this.OBSTACLE_SPEED_MIN + levelBoost, this.OBSTACLE_SPEED_MAX + levelBoost);
        const x = side === 0 ? -this.OBSTACLE_SIZE : width + this.OBSTACLE_SIZE;

        // Pick a random obstacle image if available, otherwise fallback to red rectangle
        let obstacle;
        if (this.obstacleImages.length > 0) {
            const randomImage = this.obstacleImages[Math.floor(Math.random() * this.obstacleImages.length)];
            obstacle = this.add.sprite(x, y, randomImage).setOrigin(0.5, 1).setDisplaySize(this.OBSTACLE_SIZE, this.OBSTACLE_SIZE);
        } else {
            obstacle = this.add.rectangle(x, y, this.OBSTACLE_SIZE, this.OBSTACLE_SIZE, 0xff4444).setOrigin(0.5, 1);
        }

        // Use dynamic physics body so velocity moves the obstacle
        this.physics.add.existing(obstacle);
        obstacle.body.setSize(this.OBSTACLE_SIZE * 0.8, this.OBSTACLE_SIZE * 0.8); // Tighter hitbox
        this.obstacles.add(obstacle);
        // Move across the screen
        const vx = side === 0 ? speed : -speed;
        obstacle.body.setAllowGravity(false);
        obstacle.body.setImmovable(true);
        obstacle.setDepth(10);
        obstacle.body.setVelocityX(vx);
    }

    handleObstacleHit(playerObj, obstacleObj) {
        // Only trigger hit if player is not jumping (on the ground)
        if (this.isJumping) {
            return; // Player is in the air, no collision
        }

        // Simple feedback: tint and reset to bottom-left
        playerObj.setTint(0xff0000);
        this.time.delayedCall(200, () => playerObj.clearTint());
        this.currentLevel = this.NUM_LEVELS - 1;
        playerObj.x = this.PLAYER_SIZE / 2;
        playerObj.y = this.LEVEL_HEIGHTS[this.currentLevel];
    }

    isOnLadder(px, level) {
        // Player must be close to the ladder X position for this level
        const ladderX = this.ladders[level].x;
        return Math.abs(px - ladderX) < this.LADDER_WIDTH;
    }

    snapToLadder(player, level) {
        // Snap player X to ladder X
        player.x = this.ladders[level].x;
    }

    update() {
        this.player.body.setVelocity(0);

        // Only allow left/right movement, snap Y to current level (bottom of sprite on line)
        if (this.cursors.left.isDown) {
            this.player.body.setVelocityX(-this.PLAYER_SPEED);
        } else if (this.cursors.right.isDown) {
            this.player.body.setVelocityX(this.PLAYER_SPEED);
        }
        if (!this.isJumping) {
            this.player.y = this.LEVEL_HEIGHTS[this.currentLevel];
        }

        // Prevent player from moving off ladder X when on a ladder (if not moving horizontally)
        if (this.isOnLadder(this.player.x, this.currentLevel)) {
            // Optionally snap to ladder X if very close
            if (Math.abs(this.player.x - this.ladders[this.currentLevel].x) < 2) {
                this.player.x = this.ladders[this.currentLevel].x;
            }
        }

        // Remove off-screen obstacles
        const width = this.sys.game.canvas.width;
        this.obstacles.children.iterate((obs) => {
            if (!obs) return;
            const x = obs.x;
            if (x < -this.OBSTACLE_SIZE * 2 || x > width + this.OBSTACLE_SIZE * 2) {
                obs.destroy();
            }
        });
    }
}

export default Level1Scene;
