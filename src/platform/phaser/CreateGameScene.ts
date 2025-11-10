import Phaser from 'phaser';
import { CivilizationRegistry } from '@engine/civilization/Civilization';
import { RestGameClient } from '@/network/RestGameClient';

/**
 * Scene for creating a new multiplayer game
 */
export class CreateGameScene extends Phaser.Scene {
  private selectedCivId: string | null = null;
  private gameName: string = '';
  private apiBaseUrl: string = 'http://localhost:3000/api';
  private statusText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('CreateGameScene');
  }

  create() {
    const { width, height } = this.cameras.main;

    // Title
    const title = this.add.text(width / 2, 80, 'Create Multiplayer Game', {
      fontSize: '48px',
      color: '#ffffff',
      fontFamily: 'Arial',
    });
    title.setOrigin(0.5, 0.5);

    // API URL input
    const apiLabel = this.add.text(width / 2 - 200, 150, 'API URL:', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'Arial',
    });
    apiLabel.setOrigin(0, 0.5);

    // Simple text input simulation (in a real app, you'd use a proper input component)
    const apiInputBg = this.add.rectangle(width / 2, 150, 400, 40, 0x2a2a2a, 0.8);
    apiInputBg.setStrokeStyle(2, 0x666666);
    const apiInputText = this.add.text(width / 2, 150, this.apiBaseUrl, {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial',
    });
    apiInputText.setOrigin(0.5, 0.5);

    // Game name input
    const nameLabel = this.add.text(width / 2 - 200, 220, 'Game Name:', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'Arial',
    });
    nameLabel.setOrigin(0, 0.5);

    const nameInputBg = this.add.rectangle(width / 2, 220, 400, 40, 0x2a2a2a, 0.8);
    nameInputBg.setStrokeStyle(2, 0x666666);
    const nameInputText = this.add.text(width / 2, 220, 'Enter game name...', {
      fontSize: '18px',
      color: '#888888',
      fontFamily: 'Arial',
    });
    nameInputText.setOrigin(0.5, 0.5);

    // Load civilizations
    const civilizationData = this.cache.json.get('civilizations');
    const registry = new CivilizationRegistry(civilizationData);
    const civilizations = registry.getAll();

    // Civilization selection
    const civLabel = this.add.text(width / 2, 300, 'Select Your Civilization', {
      fontSize: '28px',
      color: '#ffffff',
      fontFamily: 'Arial',
    });
    civLabel.setOrigin(0.5, 0.5);

    // Create civilization selection buttons
    const startY = 360;
    const buttonSpacing = 80;
    const buttonWidth = 300;
    const buttonHeight = 60;

    civilizations.forEach((civ, index) => {
      const buttonY = startY + index * buttonSpacing;
      const buttonX = width / 2;

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

      const civName = this.add.text(buttonX, buttonY - 10, civ.name, {
        fontSize: '24px',
        color: '#ffffff',
        fontFamily: 'Arial',
      });
      civName.setOrigin(0.5, 0.5);

      const colorIndicator = this.add.rectangle(
        buttonX - buttonWidth / 2 + 30,
        buttonY,
        20,
        20,
        parseInt(civ.color, 16),
      );
      colorIndicator.setStrokeStyle(1, 0xffffff);

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
        this.updateCreateButton();
      });
    });

    // Status text
    this.statusText = this.add.text(width / 2, height - 150, '', {
      fontSize: '18px',
      color: '#ffff00',
      fontFamily: 'Arial',
    });
    this.statusText.setOrigin(0.5, 0.5);

    // Create Game button
    const createButtonY = height - 100;
    const createButton = this.add.rectangle(
      width / 2,
      createButtonY,
      250,
      60,
      0x2a2a2a,
      0.6,
    );
    createButton.setStrokeStyle(2, 0x666666);
    createButton.setName('create-button');

    const createButtonText = this.add.text(width / 2, createButtonY, 'Create Game', {
      fontSize: '32px',
      color: '#888888',
      fontFamily: 'Arial',
    });
    createButtonText.setOrigin(0.5, 0.5);

    const updateCreateButton = () => {
      if (this.selectedCivId && this.gameName.trim()) {
        createButton.setFillStyle(0x4a4a4a, 0.8);
        createButton.setStrokeStyle(2, 0xffffff);
        createButtonText.setColor('#ffffff');
        createButton.setInteractive({ useHandCursor: true });
      } else {
        createButton.setFillStyle(0x2a2a2a, 0.6);
        createButton.setStrokeStyle(2, 0x666666);
        createButtonText.setColor('#888888');
        createButton.disableInteractive();
      }
    };

    this.updateCreateButton = updateCreateButton;

    createButton.on('pointerdown', async () => {
      if (this.selectedCivId && this.gameName.trim()) {
        await this.createGame();
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
      this.scene.start('MultiplayerMenuScene');
    });
    backButton.on('pointerover', () => {
      backButton.setColor('#aaaaaa');
    });
    backButton.on('pointerout', () => {
      backButton.setColor('#ffffff');
    });

    // Simple input handling (for demo - in production use proper input components)
    // For now, we'll use a default game name
    this.gameName = `Game ${Date.now()}`;
    nameInputText.setText(this.gameName);
    updateCreateButton();
  }

  private updateCreateButton: () => void = () => {};

  private async createGame() {
    // Get map dimensions from cache (same map file used by GameScene)
    const mapJson = this.cache.json.get('map');
    const mapWidth = mapJson?.width || 20;
    const mapHeight = mapJson?.height || 12;
    if (!this.selectedCivId || !this.gameName.trim()) return;

    if (this.statusText) {
      this.statusText.setText('Creating game...');
      this.statusText.setColor('#ffff00');
    }

    try {
      // Create game session via API
      const response = await fetch(`${this.apiBaseUrl}/games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: this.gameName,
          playerName: 'Player',
          civilizationId: this.selectedCivId,
          mapWidth,
          mapHeight,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create game: ${response.statusText}`);
      }

      const gameData = await response.json();

      if (this.statusText) {
        this.statusText.setText(`Game created! Session ID: ${gameData.sessionId}`);
        this.statusText.setColor('#00ff00');
      }

      // Wait a moment then start the game
      setTimeout(() => {
        this.scene.start('GameScene', {
          multiplayer: true,
          sessionId: gameData.sessionId,
          playerId: gameData.playerId,
          selectedCivId: this.selectedCivId,
          apiBaseUrl: this.apiBaseUrl,
        });
      }, 1500);
    } catch (error) {
      console.error('Failed to create game:', error);
      if (this.statusText) {
        this.statusText.setText(
          `Error: ${error instanceof Error ? error.message : 'Failed to create game'}`,
        );
        this.statusText.setColor('#ff0000');
      }
    }
  }
}

