import Phaser from 'phaser';
import { CivilizationRegistry } from '@engine/civilization/Civilization';

/**
 * Scene for selecting a civilization before starting a new game.
 */
export class CivilizationSelectionScene extends Phaser.Scene {
  private selectedCivId: string | null = null;

  constructor() {
    super('CivilizationSelectionScene');
  }

  create() {
    const { width, height } = this.cameras.main;

    // Title
    const title = this.add.text(width / 2, 80, 'Select Your Civilization', {
      fontSize: '48px',
      color: '#ffffff',
      fontFamily: 'Arial',
    });
    title.setOrigin(0.5, 0.5);

    // Load civilizations
    const civilizationData = this.cache.json.get('civilizations');
    const registry = new CivilizationRegistry(civilizationData);
    const civilizations = registry.getAll();

    // Start Game button (only enabled when a civilization is selected)
    const startButtonY = height - 100;
    const startButton = this.add.rectangle(
      width / 2,
      startButtonY,
      250,
      60,
      0x2a2a2a,
      0.6,
    );
    startButton.setStrokeStyle(2, 0x666666);

    const startButtonText = this.add.text(width / 2, startButtonY, 'Start Game', {
      fontSize: '32px',
      color: '#888888',
      fontFamily: 'Arial',
    });
    startButtonText.setOrigin(0.5, 0.5);

    // Update start button state
    const updateStartButton = () => {
      if (this.selectedCivId) {
        startButton.setFillStyle(0x4a4a4a, 0.8);
        startButton.setStrokeStyle(2, 0xffffff);
        startButtonText.setColor('#ffffff');
        startButton.setInteractive({ useHandCursor: true });
      } else {
        startButton.setFillStyle(0x2a2a2a, 0.6);
        startButton.setStrokeStyle(2, 0x666666);
        startButtonText.setColor('#888888');
        startButton.disableInteractive();
      }
    };

    // Create civilization selection buttons
    const startY = 200;
    const buttonSpacing = 100;
    const buttonWidth = 300;
    const buttonHeight = 70;

    civilizations.forEach((civ, index) => {
      const buttonY = startY + index * buttonSpacing;
      const buttonX = width / 2;

      // Button background
      const buttonBg = this.add.rectangle(
        buttonX,
        buttonY,
        buttonWidth,
        buttonHeight,
        0x4a4a4a,
        0.8,
      );
      buttonBg.setStrokeStyle(2, 0xffffff);
      buttonBg.setInteractive({ useHandCursor: true });

      // Civilization name
      const civName = this.add.text(buttonX, buttonY - 10, civ.name, {
        fontSize: '28px',
        color: '#ffffff',
        fontFamily: 'Arial',
      });
      civName.setOrigin(0.5, 0.5);

      // Civilization color indicator
      const colorIndicator = this.add.rectangle(
        buttonX - buttonWidth / 2 + 30,
        buttonY,
        20,
        20,
        parseInt(civ.color, 16),
      );
      colorIndicator.setStrokeStyle(1, 0xffffff);

      // Hover effects
      buttonBg.on('pointerover', () => {
        buttonBg.setFillStyle(0x5a5a5a, 0.9);
        buttonBg.setStrokeStyle(2, parseInt(civ.color, 16));
      });
      buttonBg.on('pointerout', () => {
        if (this.selectedCivId !== civ.id) {
          buttonBg.setFillStyle(0x4a4a4a, 0.8);
          buttonBg.setStrokeStyle(2, 0xffffff);
        }
      });

      // Click handler
      buttonBg.on('pointerdown', () => {
        // Deselect previous
        if (this.selectedCivId) {
          const prevButton = this.children.getByName(`civ-button-${this.selectedCivId}`);
          if (prevButton && prevButton instanceof Phaser.GameObjects.Rectangle) {
            prevButton.setFillStyle(0x4a4a4a, 0.8);
            prevButton.setStrokeStyle(2, 0xffffff);
          }
        }

        // Select this civilization
        this.selectedCivId = civ.id;
        buttonBg.setFillStyle(0x6a6a6a, 1.0);
        buttonBg.setStrokeStyle(3, parseInt(civ.color, 16));
        buttonBg.setName(`civ-button-${civ.id}`);
        
        // Update start button
        updateStartButton();
      });
    });

    // Start game handler
    startButton.on('pointerdown', () => {
      if (this.selectedCivId) {
        // Pass selected civilization to GameScene
        this.scene.start('GameScene', { selectedCivId: this.selectedCivId });
      }
    });

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
  }
}

