import Phaser from 'phaser';

export interface ButtonConfig {
  x: number;
  y: number;
  width?: number;
  height?: number;
  text: string;
  fontSize?: number;
  onClick: () => void;
  fillColor?: number;
  fillAlpha?: number;
  strokeColor?: number;
  strokeWidth?: number;
  hoverFillColor?: number;
  hoverFillAlpha?: number;
}

/**
 * Utility builder for creating consistent buttons across Phaser scenes
 */
export class ButtonBuilder {
  /**
   * Creates a standard menu button with hover effects
   */
  static createMenuButton(
    scene: Phaser.Scene,
    config: ButtonConfig,
  ): Phaser.GameObjects.Rectangle {
    const {
      x,
      y,
      width = 250,
      height = 60,
      text,
      fontSize = 32,
      onClick,
      fillColor = 0x4a4a4a,
      fillAlpha = 0.8,
      strokeColor = 0xffffff,
      strokeWidth = 2,
      hoverFillColor = 0x5a5a5a,
      hoverFillAlpha = 0.9,
    } = config;

    const buttonBg = scene.add.rectangle(x, y, width, height, fillColor, fillAlpha);
    buttonBg.setStrokeStyle(strokeWidth, strokeColor);
    buttonBg.setInteractive({ useHandCursor: true });

    const buttonText = scene.add.text(x, y, text, {
      fontSize: `${fontSize}px`,
      color: '#ffffff',
      fontFamily: 'Arial',
    });
    buttonText.setOrigin(0.5, 0.5);
    buttonText.setInteractive({ useHandCursor: true });

    const hoverIn = () => {
      buttonBg.setFillStyle(hoverFillColor, hoverFillAlpha);
    };

    const hoverOut = () => {
      buttonBg.setFillStyle(fillColor, fillAlpha);
    };

    buttonBg.on('pointerdown', onClick);
    buttonBg.on('pointerover', hoverIn);
    buttonBg.on('pointerout', hoverOut);

    buttonText.on('pointerdown', onClick);
    buttonText.on('pointerover', hoverIn);
    buttonText.on('pointerout', hoverOut);

    return buttonBg;
  }

  /**
   * Creates a simple text button (for back buttons, etc.)
   */
  static createTextButton(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    onClick: () => void,
    fontSize: number = 24,
  ): Phaser.GameObjects.Text {
    const buttonText = scene.add.text(x, y, text, {
      fontSize: `${fontSize}px`,
      color: '#ffffff',
      fontFamily: 'Arial',
    });
    buttonText.setInteractive({ useHandCursor: true });
    buttonText.on('pointerdown', onClick);
    buttonText.on('pointerover', () => {
      buttonText.setColor('#aaaaaa');
    });
    buttonText.on('pointerout', () => {
      buttonText.setColor('#ffffff');
    });

    return buttonText;
  }
}

