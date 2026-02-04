// Intro Scene - Start Screen
class IntroScene extends Phaser.Scene {
    constructor() {
        super({ key: 'IntroScene' });
    }

    preload() {
        // Preload loading image shown between intro and level 1
        this.load.image('win95Loading', 'assets/img/wins95-loading.png');
    }

    create() {
        const width = this.sys.game.canvas.width;
        const height = this.sys.game.canvas.height;

        // Black background
        this.cameras.main.setBackgroundColor('#000000');

        // "Starting Windows 95..." text - top left corner
        const startingText = this.add.text(10, 10, 'Starting Windows 95...', {
            fontFamily: "'Perfect DOS VGA 437', sans-serif",
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0, 0);

        // Blinking cursor after the text
        const cursor = this.add.text(startingText.x + startingText.width, 10, '_', {
            fontFamily: "'Perfect DOS VGA 437', sans-serif",
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0, 0);

        // Make cursor blink
        this.tweens.add({
            targets: cursor,
            alpha: 0,
            duration: 500,
            ease: 'Linear',
            yoyo: true,
            repeat: -1
        });

        // "Press START" text - below starting text, blinking effect
        const pressStartText = this.add.text(10, 40, 'Press space to START', {
            fontFamily: "'Perfect DOS VGA 437', sans-serif",
            fontSize: '24px',
            color: '#ffffff'
        }).setOrigin(0, 0);

        // Make "Press START" blink
        this.tweens.add({
            targets: pressStartText,
            alpha: 0,
            duration: 800,
            ease: 'Linear',
            yoyo: true,
            repeat: -1
        });

        // Function to show loading image and delay before starting level 1
        const startLoading = () => {
            // Prevent duplicate triggers
            this.input.keyboard.removeAllListeners('keydown');
            this.input.removeAllListeners('pointerdown');

            // Stop blinking and show loading screen
            this.tweens.killTweensOf(pressStartText);
            pressStartText.setAlpha(1);

            const w = this.sys.game.canvas.width;
            const h = this.sys.game.canvas.height;
            if (this.textures.exists('win95Loading')) {
                this.loadingImage = this.add.image(w / 2, h / 2, 'win95Loading')
                    .setOrigin(0.5, 0.5)
                    .setDisplaySize(w, h);
            } else {
                // Fallback if asset missing
                this.loadingImage = this.add.text(w / 2, h / 2, 'Loading...', {
                    fontFamily: "'Perfect DOS VGA 437', sans-serif",
                    fontSize: '24px',
                    color: '#ffffff'
                }).setOrigin(0.5);
            }

            // Wait 5 seconds before loading the actual game screen
            this.time.delayedCall(5000, () => {
                this.scene.start('Level1Scene');
            });
        };

        // Listen for any key press or click to start
        this.input.keyboard.once('keydown', startLoading);
        this.input.once('pointerdown', startLoading);

        // Handle resize
        this.scale.on('resize', (gameSize) => {
            const newWidth = gameSize.width;
            const newHeight = gameSize.height;
            startingText.setPosition(10, 10);
            cursor.setPosition(startingText.x + startingText.width, 10);
            pressStartText.setPosition(10, 40);
            if (this.loadingImage) {
                this.loadingImage.setPosition(newWidth / 2, newHeight / 2);
                if (this.loadingImage.setDisplaySize) {
                    this.loadingImage.setDisplaySize(newWidth, newHeight);
                }
            }
        });
    }
}

export default IntroScene;
