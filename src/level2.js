// Level 2 - Recycle Bin Shoot 'Em Up Scene
class Level2Scene extends Phaser.Scene {
    constructor() {
        super({ key: 'Level2Scene' });

        // ---- Player constants ----
        this.PLAYER_WIDTH = 60;
        this.PLAYER_HEIGHT = 30;
        this.PLAYER_SPEED = 250;
        this.PLAYER_COLOR = 0xffffff;
        this.PLAYER_MAX_HP = 3;
        this.PLAYER_INVULN_MS = 1500;
        this.PLAYER_MOVEMENT_BOUND = 0.4;

        // ---- Bullet constants ----
        this.BULLET_WIDTH = 12;
        this.BULLET_HEIGHT = 4;
        this.BULLET_COLOR = 0xffff00;
        this.BULLET_SPEED = 500;
        this.FIRE_RATE_MS = 200;

        // ---- Enemy constants ----
        this.ENEMY_SIZE_SMALL = 20;
        this.ENEMY_SIZE_MEDIUM = 30;
        this.ENEMY_SIZE_LARGE = 40;
        this.ENEMY_SPEED_SLOW = 100;
        this.ENEMY_SPEED_MEDIUM = 160;
        this.ENEMY_SPEED_FAST = 220;
        this.ENEMY_COLOR_VIRUS = 0xff0000;
        this.ENEMY_COLOR_CORRUPTION = 0x9900ff;
        this.ENEMY_COLOR_FAST = 0xff00ff;
        this.ENEMY_SINE_AMPLITUDE = 80;
        this.ENEMY_SINE_FREQUENCY = 0.003;

        // ---- Wave system ----
        this.TOTAL_WAVES = 6;
        this.WAVE_PAUSE_MS = 2000;
        this.WAVE_SPAWN_INTERVAL_MS = 800;

        // ---- Background / Visual ----
        this.BG_COLOR = '#1a5276';
        this.RECYCLE_BIN_COLOR = 0x2ecc71;
        this.RECYCLE_BIN_SIZE = 50;
        this.NUM_RECYCLE_BINS = 5;
        this.CORRUPTION_MAX_RECTS = 30;
        this.CORRUPTION_RECT_LIFETIME_MS = 300;

        // ---- HUD ----
        this.HUD_FONT_FAMILY = "'Perfect DOS VGA 437', sans-serif";
        this.HUD_FONT_SIZE = '20px';
        this.HUD_COLOR = '#ffffff';
        this.HUD_Y = 10;

        // ---- Game state ----
        this.player = null;
        this.clippyOverlay = null;
        this.cursors = null;
        this.bullets = null;
        this.enemies = null;
        this.fireTimer = null;
        this.playerHP = this.PLAYER_MAX_HP;
        this.isInvulnerable = false;
        this.score = 0;
        this.currentWave = 0;
        this.waveActive = false;
        this.waveEnemiesRemaining = 0;
        this.waveSpawnTimer = null;
        this.allWavesComplete = false;
        this.corruptionLevel = 0;
        this.corruptionTimer = null;
        this.recycleBins = [];
        this.hudScore = null;
        this.hudWave = null;
        this.hudHP = null;
        this.portalActive = false;
        this.portal = null;
        this.bgElements = [];
        this.sineEnemies = [];
    }

    preload() {
        this.load.image('clippyL2', 'assets/img/clippy.png');
    }

    create() {
        const width = this.sys.game.canvas.width;
        const height = this.sys.game.canvas.height;

        this.cameras.main.setBackgroundColor(this.BG_COLOR);
        this.drawBackground(width, height);

        // Player: white rectangle (paper airplane) with Clippy overlay
        const playerX = width * 0.1;
        const playerY = height / 2;

        this.player = this.add.rectangle(playerX, playerY,
            this.PLAYER_WIDTH, this.PLAYER_HEIGHT, this.PLAYER_COLOR);
        this.physics.add.existing(this.player);
        this.player.body.setCollideWorldBounds(true);
        this.player.setDepth(10);

        this.clippyOverlay = this.add.image(playerX, playerY - 10, 'clippyL2')
            .setDisplaySize(25, 25).setDepth(11);

        // WASD + Arrow keys for 4-directional movement
        this.cursors = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D,
            arrowUp: Phaser.Input.Keyboard.KeyCodes.UP,
            arrowDown: Phaser.Input.Keyboard.KeyCodes.DOWN,
            arrowLeft: Phaser.Input.Keyboard.KeyCodes.LEFT,
            arrowRight: Phaser.Input.Keyboard.KeyCodes.RIGHT
        });

        // Bullet physics group
        this.bullets = this.physics.add.group({ allowGravity: false });

        // Auto-fire timer
        this.fireTimer = this.time.addEvent({
            delay: this.FIRE_RATE_MS,
            loop: true,
            callback: this.fireBullet,
            callbackScope: this
        });

        // Enemy physics group
        this.enemies = this.physics.add.group({ allowGravity: false });
        this.sineEnemies = [];

        // Bullet-enemy collision
        this.physics.add.overlap(this.bullets, this.enemies,
            this.handleBulletHitEnemy, undefined, this);

        // Enemy-player collision
        this.physics.add.overlap(this.player, this.enemies,
            this.handleEnemyHitPlayer, undefined, this);

        // HUD
        this.hudHP = this.add.text(10, this.HUD_Y + 30, '', {
            fontFamily: this.HUD_FONT_FAMILY,
            fontSize: this.HUD_FONT_SIZE,
            color: this.HUD_COLOR
        }).setDepth(100);

        this.hudWave = this.add.text(width / 2, this.HUD_Y + 30, '', {
            fontFamily: this.HUD_FONT_FAMILY,
            fontSize: this.HUD_FONT_SIZE,
            color: this.HUD_COLOR
        }).setOrigin(0.5, 0).setDepth(100);

        this.hudScore = this.add.text(width - 10, this.HUD_Y + 30, '', {
            fontFamily: this.HUD_FONT_FAMILY,
            fontSize: this.HUD_FONT_SIZE,
            color: this.HUD_COLOR
        }).setOrigin(1, 0).setDepth(100);

        this.playerHP = this.PLAYER_MAX_HP;
        this.score = 0;
        this.currentWave = 0;
        this.waveActive = false;
        this.allWavesComplete = false;
        this.corruptionLevel = 0;
        this.updateHUD();

        // Corruption timer
        this.corruptionTimer = this.time.addEvent({
            delay: 200,
            loop: true,
            callback: this.spawnCorruptionRect,
            callbackScope: this
        });

        // Start wave 1 after a short delay
        this.time.delayedCall(1500, () => {
            this.startWave(1);
        });

        // Handle resize
        this.scale.on('resize', () => {
            const w = this.sys.game.canvas.width;
            const h = this.sys.game.canvas.height;
            this.drawBackground(w, h);
            if (this.player.x > w * this.PLAYER_MOVEMENT_BOUND) {
                this.player.x = w * this.PLAYER_MOVEMENT_BOUND;
            }
            this.hudWave.setPosition(w / 2, this.HUD_Y + 30);
            this.hudScore.setPosition(w - 10, this.HUD_Y + 30);
        });
    }

    fireBullet() {
        if (this.allWavesComplete || this.playerHP <= 0) return;

        const bullet = this.add.rectangle(
            this.player.x + this.PLAYER_WIDTH / 2,
            this.player.y,
            this.BULLET_WIDTH,
            this.BULLET_HEIGHT,
            this.BULLET_COLOR
        );
        this.physics.add.existing(bullet);
        bullet.body.setAllowGravity(false);
        this.bullets.add(bullet);
        bullet.body.setVelocityX(this.BULLET_SPEED);
        bullet.setDepth(5);
    }

    getWaveConfig(waveNumber) {
        const configs = {
            1: { totalEnemies: 8, spawnInterval: 1000, types: [{ type: 'straight', weight: 1 }], speed: this.ENEMY_SPEED_SLOW, size: this.ENEMY_SIZE_MEDIUM, fromBins: false },
            2: { totalEnemies: 12, spawnInterval: 800, types: [{ type: 'straight', weight: 2 }, { type: 'sine', weight: 1 }], speed: this.ENEMY_SPEED_SLOW, size: this.ENEMY_SIZE_MEDIUM, fromBins: false },
            3: { totalEnemies: 15, spawnInterval: 700, types: [{ type: 'straight', weight: 1 }, { type: 'sine', weight: 2 }], speed: this.ENEMY_SPEED_MEDIUM, size: this.ENEMY_SIZE_MEDIUM, fromBins: true },
            4: { totalEnemies: 18, spawnInterval: 600, types: [{ type: 'straight', weight: 1 }, { type: 'sine', weight: 2 }, { type: 'fast', weight: 1 }], speed: this.ENEMY_SPEED_MEDIUM, size: this.ENEMY_SIZE_SMALL, fromBins: true },
            5: { totalEnemies: 22, spawnInterval: 500, types: [{ type: 'sine', weight: 2 }, { type: 'fast', weight: 2 }], speed: this.ENEMY_SPEED_FAST, size: this.ENEMY_SIZE_SMALL, fromBins: true },
            6: { totalEnemies: 28, spawnInterval: 400, types: [{ type: 'straight', weight: 1 }, { type: 'sine', weight: 2 }, { type: 'fast', weight: 3 }], speed: this.ENEMY_SPEED_FAST, size: this.ENEMY_SIZE_LARGE, fromBins: true }
        };
        return configs[waveNumber];
    }

    pickWeightedType(types) {
        let total = types.reduce((sum, t) => sum + t.weight, 0);
        let r = Math.random() * total;
        for (const t of types) {
            r -= t.weight;
            if (r <= 0) return t.type;
        }
        return types[0].type;
    }

    startWave(waveNumber) {
        this.currentWave = waveNumber;
        this.waveActive = true;
        const config = this.getWaveConfig(waveNumber);
        this.waveEnemiesRemaining = config.totalEnemies;
        this.corruptionLevel = (waveNumber - 1) / (this.TOTAL_WAVES - 1);
        this.updateHUD();

        // Wave announcement
        const width = this.sys.game.canvas.width;
        const height = this.sys.game.canvas.height;
        const waveText = this.add.text(width / 2, height / 2, `WAVE ${waveNumber}`, {
            fontFamily: this.HUD_FONT_FAMILY,
            fontSize: '48px',
            color: '#ffff00'
        }).setOrigin(0.5).setDepth(200);

        this.tweens.add({
            targets: waveText,
            alpha: 0,
            duration: 1000,
            delay: 500,
            onComplete: () => waveText.destroy()
        });

        // Spawn enemies at intervals
        this.waveSpawnTimer = this.time.addEvent({
            delay: config.spawnInterval,
            repeat: config.totalEnemies - 1,
            callback: () => this.spawnEnemy(config),
            callbackScope: this
        });
    }

    spawnEnemy(config) {
        const width = this.sys.game.canvas.width;
        const height = this.sys.game.canvas.height;
        const type = this.pickWeightedType(config.types);

        // Determine spawn position
        let spawnX, spawnY;
        if (config.fromBins && Math.random() < 0.3 && this.recycleBins.length > 0) {
            const bin = this.recycleBins[Phaser.Math.Between(0, this.recycleBins.length - 1)];
            spawnX = bin.x;
            spawnY = bin.y;
            // Flash bin red
            if (bin.sprite && bin.sprite.active) {
                bin.sprite.setFillStyle(0xff0000);
                this.time.delayedCall(200, () => {
                    if (bin.sprite && bin.sprite.active) {
                        bin.sprite.setFillStyle(this.RECYCLE_BIN_COLOR);
                    }
                });
            }
        } else {
            spawnX = width + config.size;
            spawnY = Phaser.Math.Between(50, height - 50);
        }

        // Color by type
        let color;
        switch (type) {
            case 'sine': color = this.ENEMY_COLOR_CORRUPTION; break;
            case 'fast': color = this.ENEMY_COLOR_FAST; break;
            default: color = this.ENEMY_COLOR_VIRUS; break;
        }

        // Create enemy shape
        let enemy;
        if (type === 'fast') {
            enemy = this.add.rectangle(spawnX, spawnY, config.size * 0.8, config.size * 0.8, color);
        } else {
            enemy = this.add.circle(spawnX, spawnY, config.size / 2, color);
        }
        this.physics.add.existing(enemy);
        enemy.body.setAllowGravity(false);
        this.enemies.add(enemy);
        enemy.setDepth(8);

        const speed = type === 'fast' ? config.speed * 1.5 : config.speed;
        enemy.body.setVelocityX(-speed);

        if (type === 'sine') {
            this.sineEnemies.push({
                obj: enemy,
                baseY: spawnY,
                startTime: this.time.now
            });
        }
    }

    onWaveCleared() {
        this.waveActive = false;
        if (this.waveSpawnTimer) this.waveSpawnTimer.remove();

        if (this.currentWave >= this.TOTAL_WAVES) {
            this.allWavesComplete = true;
            this.showWinPortal();
        } else {
            const width = this.sys.game.canvas.width;
            const height = this.sys.game.canvas.height;
            const clearText = this.add.text(width / 2, height / 2, 'WAVE CLEARED!', {
                fontFamily: this.HUD_FONT_FAMILY,
                fontSize: '36px',
                color: '#00ff00'
            }).setOrigin(0.5).setDepth(200);

            this.tweens.add({
                targets: clearText,
                alpha: 0,
                duration: 800,
                delay: 1000,
                onComplete: () => clearText.destroy()
            });

            this.time.delayedCall(this.WAVE_PAUSE_MS, () => {
                this.startWave(this.currentWave + 1);
            });
        }
    }

    checkWaveCleared() {
        if (this.waveActive && this.waveEnemiesRemaining <= 0 && this.enemies.countActive() === 0) {
            this.onWaveCleared();
        }
    }

    handleBulletHitEnemy(bullet, enemy) {
        bullet.destroy();
        enemy.setFillStyle(0xffffff);
        this.time.delayedCall(50, () => {
            if (enemy && enemy.active) enemy.destroy();
        });
        this.sineEnemies = this.sineEnemies.filter(e => e.obj !== enemy);
        this.score += 10;
        this.waveEnemiesRemaining--;
        this.updateHUD();
        this.checkWaveCleared();
    }

    handleEnemyHitPlayer(playerObj, enemyObj) {
        if (this.isInvulnerable || this.playerHP <= 0) return;

        this.playerHP--;
        this.updateHUD();
        enemyObj.destroy();
        this.sineEnemies = this.sineEnemies.filter(e => e.obj !== enemyObj);
        this.waveEnemiesRemaining--;

        if (this.playerHP <= 0) {
            this.handleGameOver();
            return;
        }

        // Invulnerability with flash
        this.isInvulnerable = true;
        this.tweens.add({
            targets: this.player,
            alpha: 0.3,
            duration: 100,
            yoyo: true,
            repeat: Math.floor(this.PLAYER_INVULN_MS / 200),
            onComplete: () => {
                this.player.setAlpha(1);
                this.isInvulnerable = false;
            }
        });

        this.checkWaveCleared();
    }

    handleGameOver() {
        if (this.fireTimer) this.fireTimer.remove();
        if (this.waveSpawnTimer) this.waveSpawnTimer.remove();
        if (this.corruptionTimer) this.corruptionTimer.remove();

        this.player.setFillStyle(0xff0000);
        if (this.clippyOverlay) this.clippyOverlay.setVisible(false);

        const width = this.sys.game.canvas.width;
        const height = this.sys.game.canvas.height;

        this.add.text(width / 2, height / 2, 'SYSTEM CORRUPTED\nGAME OVER', {
            fontFamily: this.HUD_FONT_FAMILY,
            fontSize: '48px',
            color: '#ff0000',
            align: 'center'
        }).setOrigin(0.5).setDepth(300);

        const restartText = this.add.text(width / 2, height / 2 + 80, 'Press SPACE to retry', {
            fontFamily: this.HUD_FONT_FAMILY,
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0.5).setDepth(300);

        this.tweens.add({
            targets: restartText,
            alpha: 0,
            duration: 500,
            yoyo: true,
            repeat: -1
        });

        this.input.keyboard.once('keydown-SPACE', () => {
            this.scene.restart();
        });
    }

    showWinPortal() {
        if (this.fireTimer) this.fireTimer.remove();
        if (this.corruptionTimer) this.corruptionTimer.remove();
        this.portalActive = true;

        const width = this.sys.game.canvas.width;
        const height = this.sys.game.canvas.height;
        const portalX = width * 0.7;
        const portalY = height * 0.5;

        // Outer glow
        const portalGlow = this.add.circle(portalX, portalY, 60, 0x00ff00, 0.3).setDepth(90);
        this.tweens.add({
            targets: portalGlow,
            scaleX: 1.5, scaleY: 1.5, alpha: 0.1,
            duration: 800, yoyo: true, repeat: -1
        });

        // Inner portal
        this.portal = this.add.circle(portalX, portalY, 35, 0x00ff00).setDepth(91);
        this.tweens.add({
            targets: this.portal,
            scaleX: 1.2, scaleY: 1.2,
            duration: 600, yoyo: true, repeat: -1
        });

        // Arrow
        const arrow = this.add.text(portalX, portalY - 80, 'v v v', {
            fontFamily: this.HUD_FONT_FAMILY,
            fontSize: '32px',
            color: '#00ff00'
        }).setOrigin(0.5).setDepth(92);
        this.tweens.add({
            targets: arrow,
            y: portalY - 60,
            duration: 500, yoyo: true, repeat: -1
        });

        this.add.text(width / 2, height * 0.15, 'RECYCLE BIN PURIFIED!\nENTER THE PORTAL', {
            fontFamily: this.HUD_FONT_FAMILY,
            fontSize: '28px',
            color: '#00ff00',
            align: 'center'
        }).setOrigin(0.5).setDepth(200);

        // Enable player to fly to portal
        this.PLAYER_MOVEMENT_BOUND = 1.0;

        // Portal collision
        this.physics.add.existing(this.portal);
        this.portal.body.setAllowGravity(false);
        this.portal.body.setImmovable(true);

        this.physics.add.overlap(this.player, this.portal, () => {
            if (this.portalActive) {
                this.portalActive = false;
                this.cameras.main.fadeOut(1000, 0, 0, 0);
                this.cameras.main.on('camerafadeoutcomplete', () => {
                    if (this.scene.manager.keys['Level3Scene']) {
                        this.scene.start('Level3Scene');
                    } else {
                        // Level 3 not built yet — show TO BE CONTINUED
                        this.scene.restart();
                    }
                });
            }
        }, undefined, this);
    }

    updateHUD() {
        if (this.hudHP) {
            let hpStr = 'HP: ';
            for (let i = 0; i < this.PLAYER_MAX_HP; i++) {
                hpStr += i < this.playerHP ? '[*]' : '[ ]';
            }
            this.hudHP.setText(hpStr);
        }
        if (this.hudWave) {
            this.hudWave.setText(`WAVE: ${this.currentWave} / ${this.TOTAL_WAVES}`);
        }
        if (this.hudScore) {
            this.hudScore.setText(`SCORE: ${this.score}`);
        }
    }

    spawnCorruptionRect() {
        if (this.corruptionLevel <= 0) return;
        if (Math.random() > this.corruptionLevel * 0.6) return;

        const width = this.sys.game.canvas.width;
        const height = this.sys.game.canvas.height;
        const rx = Phaser.Math.Between(0, width);
        const ry = Phaser.Math.Between(0, height);
        const rw = Phaser.Math.Between(10, 80 * this.corruptionLevel + 20);
        const rh = Phaser.Math.Between(5, 30 * this.corruptionLevel + 10);
        const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xff00ff, 0xffff00, 0x00ffff];
        const color = colors[Phaser.Math.Between(0, colors.length - 1)];
        const alpha = Phaser.Math.FloatBetween(0.1, 0.4 * this.corruptionLevel + 0.1);

        const rect = this.add.rectangle(rx, ry, rw, rh, color).setAlpha(alpha).setDepth(50);
        this.time.delayedCall(this.CORRUPTION_RECT_LIFETIME_MS, () => {
            if (rect && rect.active) rect.destroy();
        });
    }

    drawBackground(width, height) {
        // Destroy old background elements on resize
        if (this.bgElements) {
            this.bgElements.forEach(el => el.destroy());
        }
        this.bgElements = [];

        // XP-style title bar
        const titleBar = this.add.rectangle(width / 2, 15, width, 30, 0x0055e5).setDepth(0);
        const titleText = this.add.text(10, 5, 'Address: C:\\RECYCLER', {
            fontFamily: this.HUD_FONT_FAMILY,
            fontSize: '16px',
            color: '#ffffff'
        }).setDepth(1);
        this.bgElements.push(titleBar, titleText);

        // 5 recycle bin icons spread across the right portion
        const binStartX = width * 0.45;
        const binSpacing = (width * 0.50) / this.NUM_RECYCLE_BINS;
        const binColors = [0x2ecc71, 0x27ae60, 0x1abc9c, 0x16a085, 0x2ecc71];
        const binLabels = ['Win98', 'WinXP', 'Win7', 'Win8', 'Win10'];

        this.recycleBins = [];
        for (let i = 0; i < this.NUM_RECYCLE_BINS; i++) {
            const bx = binStartX + i * binSpacing + binSpacing / 2;
            const by = height * 0.3 + (i % 2 === 0 ? 0 : height * 0.25);
            const bin = this.add.rectangle(bx, by, this.RECYCLE_BIN_SIZE,
                this.RECYCLE_BIN_SIZE, binColors[i]).setDepth(0).setAlpha(0.6);
            const label = this.add.text(bx, by + this.RECYCLE_BIN_SIZE / 2 + 5,
                binLabels[i], {
                fontFamily: this.HUD_FONT_FAMILY,
                fontSize: '12px',
                color: '#aaffaa'
            }).setOrigin(0.5, 0).setDepth(0);
            this.bgElements.push(bin, label);
            this.recycleBins.push({ sprite: bin, x: bx, y: by });
        }
    }

    update() {
        if (!this.player || !this.player.body) return;

        const width = this.sys.game.canvas.width;

        // 4-directional movement
        this.player.body.setVelocity(0);

        if (this.cursors.left.isDown || this.cursors.arrowLeft.isDown) {
            this.player.body.setVelocityX(-this.PLAYER_SPEED);
        } else if (this.cursors.right.isDown || this.cursors.arrowRight.isDown) {
            this.player.body.setVelocityX(this.PLAYER_SPEED);
        }
        if (this.cursors.up.isDown || this.cursors.arrowUp.isDown) {
            this.player.body.setVelocityY(-this.PLAYER_SPEED);
        } else if (this.cursors.down.isDown || this.cursors.arrowDown.isDown) {
            this.player.body.setVelocityY(this.PLAYER_SPEED);
        }

        // Constrain player to left portion of screen
        const maxX = width * this.PLAYER_MOVEMENT_BOUND;
        if (this.player.x > maxX) {
            this.player.x = maxX;
            this.player.body.setVelocityX(0);
        }

        // Clippy overlay follows player
        if (this.clippyOverlay) {
            this.clippyOverlay.setPosition(this.player.x, this.player.y - 10);
        }

        // Sine wave enemy movement
        for (const se of this.sineEnemies) {
            if (se.obj && se.obj.active) {
                const elapsed = this.time.now - se.startTime;
                se.obj.y = se.baseY + Math.sin(elapsed * this.ENEMY_SINE_FREQUENCY) * this.ENEMY_SINE_AMPLITUDE;
            }
        }

        // Cleanup off-screen bullets
        this.bullets.children.iterate((bullet) => {
            if (!bullet || !bullet.active) return;
            if (bullet.x > width + 20) {
                bullet.destroy();
            }
        });

        // Cleanup off-screen enemies
        const height = this.sys.game.canvas.height;
        this.enemies.children.iterate((enemy) => {
            if (!enemy || !enemy.active) return;
            if (enemy.x < -60 || enemy.y < -60 || enemy.y > height + 60) {
                this.sineEnemies = this.sineEnemies.filter(e => e.obj !== enemy);
                enemy.destroy();
                this.waveEnemiesRemaining--;
                this.checkWaveCleared();
            }
        });
    }
}

export default Level2Scene;
