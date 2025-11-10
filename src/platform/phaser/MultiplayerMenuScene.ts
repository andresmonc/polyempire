import Phaser from 'phaser';

/**
 * Scene for multiplayer menu - create or join games
 */
export class MultiplayerMenuScene extends Phaser.Scene {
  constructor() {
    super('MultiplayerMenuScene');
  }

  create() {
    const { width, height } = this.cameras.main;

    // Title
    const title = this.add.text(width / 2, height / 4, 'Multiplayer', {
      fontSize: '48px',
      color: '#ffffff',
      fontFamily: 'Arial',
    });
    title.setOrigin(0.5, 0.5);

    // Button configuration
    const buttonWidth = 250;
    const buttonHeight = 60;
    const buttonSpacing = 80;
    const startY = height / 2;

    // Create Game button
    const createButton = this.createMenuButton(
      width / 2,
      startY,
      buttonWidth,
      buttonHeight,
      'Create Game',
      () => {
        this.scene.start('CreateGameScene');
      },
    );

    // Join Game button
    const joinButton = this.createMenuButton(
      width / 2,
      startY + buttonSpacing,
      buttonWidth,
      buttonHeight,
      'Join Game',
      () => {
        this.scene.start('JoinGameScene');
      },
    );

    // Back button
    const backButton = this.add.text(50, height - 50, '← Back', {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'Arial',
    });
    backButton.setInteractive({ useHandCursor: true });
    backButton.on('pointerdown', () => {
      this.scene.start('StartScene');
    });
    backButton.on('pointerover', () => {
      backButton.setColor('#aaaaaa');
    });
    backButton.on('pointerout', () => {
      backButton.setColor('#ffffff');
    });
  }

  private createMenuButton(
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    onClick: () => void,
  ): Phaser.GameObjects.Rectangle {
    const buttonBg = this.add.rectangle(x, y, width, height, 0x4a4a4a, 0.8);
    buttonBg.setStrokeStyle(2, 0xffffff);
    buttonBg.setInteractive({ useHandCursor: true });

    const buttonText = this.add.text(x, y, text, {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial',
    });
    buttonText.setOrigin(0.5, 0.5);
    buttonText.setInteractive({ useHandCursor: true });

    const hoverIn = () => {
      buttonBg.setFillStyle(0x5a5a5a, 0.9);
    };

    const hoverOut = () => {
      buttonBg.setFillStyle(0x4a4a4a, 0.8);
    };

    buttonBg.on('pointerdown', onClick);
    buttonBg.on('pointerover', hoverIn);
    buttonBg.on('pointerout', hoverOut);

    buttonText.on('pointerdown', onClick);
    buttonText.on('pointerover', hoverIn);
    buttonText.on('pointerout', hoverOut);

    return buttonBg;
  }
}

