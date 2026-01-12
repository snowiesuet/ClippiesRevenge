// Basic Phaser 3 starter: A and S for left/right movement
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: window.innerWidth,
        height: window.innerHeight
    },
    backgroundColor: '#222',
    physics: {
        default: 'matter', // <--- change to matter
        matter: { gravity: { y: 1 }, debug: true }
    },
    scene: { preload, create, update }
};

const game = new Phaser.Game(config);

function preload() {
    // load a PNG for the player; using a small placeholder image URL
    this.load.image('playerImg', 'https://static.wikia.nocookie.net/central/images/c/cb/Clippy.png');
    // background image (replace with local asset if preferred)
    this.load.image('bg', 'https://static0.howtogeekimages.com/wordpress/wp-content/uploads/2024/06/windows-95.jpg');
}

function create() {
    this.speed = 220;
    this.levelsCount = 3;
    this.floors = [];
    this.platformObjs = [];
    this.ladderObjs = [];
    this.ladders = [];
    this.floorGraphics = [];
    this.floorEnds = [];

    // Multi-level setup
    const gap = 150; // vertical gap between floors
    const bottomOffset = 80; // distance from bottom for lowest floor

    // add background behind everything and make it resize with the canvas
    this.bg = this.add.image(0, 0, 'bg').setOrigin(0).setDisplaySize(this.scale.width, this.scale.height);
    this.bg.setDepth(-1000);

    // helper to (re)build straight floors and ladders so they adapt to resizing
    const rebuildLevels = () => {
        // destroy existing objects
        this.platformObjs.forEach(p => this.matter.world.remove(p));
        this.ladderObjs.forEach(l => l.destroy());
        if (this.floorGraphics) this.floorGraphics.forEach(g => g.destroy());
        this.platformObjs = [];
        this.ladderObjs = [];
        this.ladders = [];
        this.floorGraphics = [];
        this.floors = [];
        this.floorEnds = [];

        const width = this.scale.width;

        for (let i = 0; i < this.levelsCount; i++) {
            // All floors are straight horizontal lines
            const y = this.scale.height - bottomOffset - i * gap;
            this.floors.push(y);
            this.floorEnds.push({ leftY: y, rightY: y });

            // draw straight floor line using graphics
            const g = this.add.graphics();
            g.lineStyle(10, 0x555555, 1);
            g.beginPath();
            g.moveTo(0, y + 5);
            g.lineTo(width, y + 5);
            g.strokePath();
            g.closePath();
            this.floorGraphics.push(g);

            // add a single static Matter rectangle for the straight floor
            const floor = this.matter.add.rectangle(
                width / 2,
                y + 5,
                width,
                10,
                { isStatic: true, angle: 0 }
            );
            this.platformObjs.push(floor);
        }

        // create ladders connecting floor i -> i+1, alternating side each level
        const marginX = 100;
        for (let i = 0; i < this.levelsCount - 1; i++) {
            const y1 = this.floors[i];
            const y2 = this.floors[i + 1];
            // alternate ladder side: even -> left end, odd -> right end
            const ladderOnLeft = (i % 2 === 0);
            const ladderX = ladderOnLeft ? marginX : (width - marginX);

            const ladderHeight = Math.max(40, Math.abs(y1 - y2));
            const ladderY = Math.min(y1, y2) + Math.abs(y1 - y2) / 2;

            // visual ladder
            const ladderVis = this.add.rectangle(ladderX, ladderY, 40, ladderHeight, 0x8B4513);
            this.ladderObjs.push(ladderVis);

            // invisible zone for overlap detection (static, Arcade physics for overlap only)
            const zone = this.add.zone(ladderX, ladderY, 40, ladderHeight);
            this.physics.add.existing(zone, true);
            zone.fromLevel = i;
            zone.toLevel = i + 1;
            this.ladders.push(zone);
        }
    };

    // initial build
    rebuildLevels();

    // Player: create after platforms and background
    this.player = this.matter.add.sprite(120, 0, 'playerImg');
    this.player.setDisplaySize(100, 100);
    this.player.setFixedRotation(); // Prevents spinning
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(1000); // Always above platforms

    // start at bottom-left (level 0)
    this.level = 0;
    this.player.x = 120;
    this.player.y = this.floors[this.level] - this.player.displayHeight / 2 - 1;
    this.player.setVelocity(0, 0);

    // Keys: A/D left-right, W up (climb), S down (climb), SPACE jump
    this.keys = this.input.keyboard.addKeys({ A: Phaser.Input.Keyboard.KeyCodes.A, D: Phaser.Input.Keyboard.KeyCodes.D, W: Phaser.Input.Keyboard.KeyCodes.W, S: Phaser.Input.Keyboard.KeyCodes.S, SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE });

    // handle resize to keep background covering the canvas
    this.scale.on('resize', (gameSize) => {
        if (this.bg) this.bg.setDisplaySize(gameSize.width, gameSize.height);
        rebuildLevels();
        // keep player on same logical level after resize
        this.player.y = this.floors[this.level] - this.player.displayHeight / 2 - 1;
        // clamp player's x inside new width
        this.player.x = Phaser.Math.Clamp(this.player.x, 0 + this.player.displayWidth / 2, gameSize.width - this.player.displayWidth / 2);
        this.player.setVelocity(0, 0);
        this.player.setDepth(1000);
    });

    this.canClimb = false;
    this.currentLadder = null;

    this.levelText = this.add.text(10, 10, 'Level: ' + this.level, { font: '16px Arial', fill: '#ffffff' });
    this.helpText = this.add.text(10, 30, 'A/D: left/right  W: up  S: down (use ladder)', { font: '14px Arial', fill: '#cccccc' });
}

function update() {
    // stop horizontal movement each frame, then apply based on keys
    this.player.setVelocityX(0);

    if (this.keys.A.isDown) {
        this.player.setVelocityX(-this.speed);
    } else if (this.keys.D.isDown) {
        this.player.setVelocityX(this.speed);
    }

    // climbing detection: reset flag then check overlap with any ladder
    this.canClimb = false;
    this.currentLadder = null;
    for (let ladder of this.ladders) {
        if (this.physics.overlap(this.player, ladder)) {
            this.canClimb = true;
            this.currentLadder = ladder;
            break;
        }
    }

    // handle climb up/down when overlapping ladder and key just pressed
    if (this.canClimb && this.currentLadder) {
        if (Phaser.Input.Keyboard.JustDown(this.keys.W)) {
            // go up if possible and ladder connects upward
            if (this.level < this.levelsCount - 1 && this.currentLadder.fromLevel === this.level) {
                this.level++;
                this.player.x = this.currentLadder.x;
                this.player.y = this.floors[this.level] - this.player.displayHeight / 2 - 1;
            }
        } else if (Phaser.Input.Keyboard.JustDown(this.keys.S)) {
            // go down if possible and ladder connects down
            if (this.level > 0 && this.currentLadder.toLevel === this.level) {
                this.level--;
                this.player.x = this.currentLadder.x;
                this.player.y = this.floors[this.level] - this.player.displayHeight / 2 - 1;
            }
        }
    }

    // Jumping with SPACE (only when on ground)
    const body = this.player.body;
    // For Matter, check if player is touching down (simple version: check velocity and y position)
    let onGround = false;
    if (body && body.parts) {
        // Check for contacts below
        const contacts = body.parts[0].contacts;
        if (contacts) {
            for (let id in contacts) {
                const contact = contacts[id];
                if (contact && contact.normal && contact.normal.y < -0.5) {
                    onGround = true;
                    break;
                }
            }
        }
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE) && onGround) {
        this.player.setVelocityY(-13); // Matter uses lower values for velocity
    }

    // update UI
    if (this.levelText) this.levelText.setText('Level: ' + this.level);
}
