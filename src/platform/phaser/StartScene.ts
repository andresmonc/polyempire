import Phaser from 'phaser';

/**
 * The start screen scene with a "New Game" button.
 */
export class StartScene extends Phaser.Scene {
  constructor() {
    super('StartScene');
  }

  create() {
    const { width, height } = this.cameras.main;

    // Title
    const title = this.add.text(width / 2, height / 3, 'PolyEmpire', {
      fontSize: '64px',
      color: '#ffffff',
      fontFamily: 'Arial',
    });
    title.setOrigin(0.5, 0.5);

    // New Game button
    const buttonWidth = 200;
    const buttonHeight = 60;
    const buttonX = width / 2;
    const buttonY = height / 2 + 100;

    const buttonBg = this.add.rectangle(
      buttonX,
      buttonY,
      buttonWidth,
      buttonHeight,
      0x4a4a4a,
      0.8,
    );
    buttonBg.setStrokeStyle(2, 0xffffff);

    const buttonText = this.add.text(buttonX, buttonY, 'New Game', {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial',
    });
    buttonText.setOrigin(0.5, 0.5);

    // Make button interactive
    buttonBg.setInteractive({ useHandCursor: true });
    buttonText.setInteractive({ useHandCursor: true });

    const onButtonClick = () => {
      this.scene.start('CivilizationSelectionScene');
    };

    buttonBg.on('pointerdown', onButtonClick);
    buttonBg.on('pointerover', () => {
      buttonBg.setFillStyle(0x5a5a5a, 0.9);
    });
    buttonBg.on('pointerout', () => {
      buttonBg.setFillStyle(0x4a4a4a, 0.8);
    });

    buttonText.on('pointerdown', onButtonClick);
    buttonText.on('pointerover', () => {
      buttonBg.setFillStyle(0x5a5a5a, 0.9);
    });
    buttonText.on('pointerout', () => {
      buttonBg.setFillStyle(0x4a4a4a, 0.8);
    });
  }
}

