import Phaser from 'phaser';
import { CivilizationRegistry } from '@engine/civilization/Civilization';

/**
 * Scene for joining an existing multiplayer game
 */
export class JoinGameScene extends Phaser.Scene {
  private sessionId: string = '';
  private selectedCivId: string | null = null;
  private apiBaseUrl: string = 'http://localhost:3000/api';
  private statusText: Phaser.GameObjects.Text | null = null;
  private sessionInfo: any = null;

  constructor() {
    super('JoinGameScene');
  }

  create() {
    const { width, height } = this.cameras.main;

    // Title
    const title = this.add.text(width / 2, 80, 'Join Multiplayer Game', {
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

    const apiInputBg = this.add.rectangle(width / 2, 150, 400, 40, 0x2a2a2a, 0.8);
    apiInputBg.setStrokeStyle(2, 0x666666);
    const apiInputText = this.add.text(width / 2, 150, this.apiBaseUrl, {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial',
    });
    apiInputText.setOrigin(0.5, 0.5);

    // Session ID input
    const sessionLabel = this.add.text(width / 2 - 200, 220, 'Session ID:', {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'Arial',
    });
    sessionLabel.setOrigin(0, 0.5);

    const sessionInputBg = this.add.rectangle(width / 2, 220, 400, 40, 0x2a2a2a, 0.8);
    sessionInputBg.setStrokeStyle(2, 0x666666);
    sessionInputBg.setInteractive({ useHandCursor: true });
    const sessionInputText = this.add.text(width / 2, 220, 'Enter session ID...', {
      fontSize: '18px',
      color: '#888888',
      fontFamily: 'Arial',
    });
    sessionInputText.setOrigin(0.5, 0.5);

    // Load button
    const loadButton = this.add.rectangle(width / 2 + 220, 220, 100, 40, 0x4a4a4a, 0.8);
    loadButton.setStrokeStyle(2, 0xffffff);
    loadButton.setInteractive({ useHandCursor: true });
    const loadButtonText = this.add.text(width / 2 + 220, 220, 'Load', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Arial',
    });
    loadButtonText.setOrigin(0.5, 0.5);

    loadButton.on('pointerdown', async () => {
      if (this.sessionId.trim()) {
        await this.loadGameInfo();
      }
    });

    loadButton.on('pointerover', () => {
      loadButton.setFillStyle(0x5a5a5a, 0.9);
    });
    loadButton.on('pointerout', () => {
      loadButton.setFillStyle(0x4a4a4a, 0.8);
    });

    // Simple input simulation - clicking the input field
    sessionInputBg.on('pointerdown', () => {
      // In a real implementation, you'd use a proper input component
      // For now, we'll use a prompt (not ideal for production)
      const input = prompt('Enter Session ID:');
      if (input) {
        this.sessionId = input.trim();
        sessionInputText.setText(this.sessionId);
        sessionInputText.setColor('#ffffff');
      }
    });

    // Status text
    this.statusText = this.add.text(width / 2, 280, '', {
      fontSize: '18px',
      color: '#ffff00',
      fontFamily: 'Arial',
    });
    this.statusText.setOrigin(0.5, 0.5);

    // Game info area (will be populated after loading)
    const gameInfoY = 320;
    const gameInfoContainer = this.add.container(width / 2, gameInfoY);
    gameInfoContainer.setName('game-info');

    // Civilization selection (hidden until game is loaded)
    const civSelectionContainer = this.add.container(width / 2, gameInfoY + 100);
    civSelectionContainer.setName('civ-selection');
    civSelectionContainer.setVisible(false);

    // Join Game button
    const joinButtonY = height - 100;
    const joinButton = this.add.rectangle(
      width / 2,
      joinButtonY,
      250,
      60,
      0x2a2a2a,
      0.6,
    );
    joinButton.setStrokeStyle(2, 0x666666);
    joinButton.setName('join-button');
    joinButton.setVisible(false);

    const joinButtonText = this.add.text(width / 2, joinButtonY, 'Join Game', {
      fontSize: '32px',
      color: '#888888',
      fontFamily: 'Arial',
    });
    joinButtonText.setOrigin(0.5, 0.5);

    joinButton.on('pointerdown', async () => {
      if (this.selectedCivId && this.sessionId) {
        await this.joinGame();
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
  }

  private async loadGameInfo() {
    if (!this.sessionId.trim()) return;

    if (this.statusText) {
      this.statusText.setText('Loading game info...');
      this.statusText.setColor('#ffff00');
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/games/${this.sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load game: ${response.statusText}`);
      }

      this.sessionInfo = await response.json();

      if (this.statusText) {
        this.statusText.setText(`Game: ${this.sessionInfo.name || this.sessionId}`);
        this.statusText.setColor('#00ff00');
      }

      // Show civilization selection
      this.showCivilizationSelection();
    } catch (error) {
      console.error('Failed to load game:', error);
      if (this.statusText) {
        this.statusText.setText(
          `Error: ${error instanceof Error ? error.message : 'Failed to load game'}`,
        );
        this.statusText.setColor('#ff0000');
      }
    }
  }

  private showCivilizationSelection() {
    const civSelectionContainer = this.children.getByName('civ-selection') as
      | Phaser.GameObjects.Container
      | undefined;
    if (!civSelectionContainer) return;

    civSelectionContainer.removeAll(true);
    civSelectionContainer.setVisible(true);

    const { width } = this.cameras.main;

    // Get available civilizations
    const civilizationData = this.cache.json.get('civilizations');
    const registry = new CivilizationRegistry(civilizationData);
    const allCivs = registry.getAll();

    // Filter out civilizations already taken
    const takenCivIds = new Set(
      (this.sessionInfo?.players || []).map((p: any) => p.civilizationId),
    );
    const availableCivs = allCivs.filter(civ => !takenCivIds.has(civ.id));

    const civLabel = this.add.text(0, -50, 'Select Your Civilization', {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'Arial',
    });
    civLabel.setOrigin(0.5, 0.5);
    civSelectionContainer.add(civLabel);

    const startY = 0;
    const buttonSpacing = 70;
    const buttonWidth = 300;
    const buttonHeight = 50;

    availableCivs.forEach((civ, index) => {
      const buttonY = startY + index * buttonSpacing;

      const buttonBg = this.add.rectangle(0, buttonY, buttonWidth, buttonHeight, 0x4a4a4a, 0.8);
      buttonBg.setStrokeStyle(2, 0xffffff);
      buttonBg.setInteractive({ useHandCursor: true });
      civSelectionContainer.add(buttonBg);

      const civName = this.add.text(0, buttonY, civ.name, {
        fontSize: '20px',
        color: '#ffffff',
        fontFamily: 'Arial',
      });
      civName.setOrigin(0.5, 0.5);
      civSelectionContainer.add(civName);

      const colorIndicator = this.add.rectangle(
        -buttonWidth / 2 + 30,
        buttonY,
        20,
        20,
        parseInt(civ.color, 16),
      );
      colorIndicator.setStrokeStyle(1, 0xffffff);
      civSelectionContainer.add(colorIndicator);

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
          const prevButton = civSelectionContainer.getByName(`civ-button-${this.selectedCivId}`);
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

        // Show join button
        const joinButton = this.children.getByName('join-button') as
          | Phaser.GameObjects.Rectangle
          | undefined;
        if (joinButton) {
          joinButton.setVisible(true);
          joinButton.setFillStyle(0x4a4a4a, 0.8);
          joinButton.setStrokeStyle(2, 0xffffff);
          joinButton.setInteractive({ useHandCursor: true });
        }
      });
    });
  }

  private async joinGame() {
    // Get map dimensions from cache (same map file used by GameScene)
    const mapJson = this.cache.json.get('map');
    const mapWidth = mapJson?.width || 20;
    const mapHeight = mapJson?.height || 12;
    if (!this.selectedCivId || !this.sessionId) return;

    const joinButton = this.children.getByName('join-button') as
      | Phaser.GameObjects.Rectangle
      | undefined;
    if (joinButton) {
      joinButton.disableInteractive();
    }

    if (this.statusText) {
      this.statusText.setText('Joining game...');
      this.statusText.setColor('#ffff00');
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/games/${this.sessionId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          playerName: 'Player',
          civilizationId: this.selectedCivId,
          mapWidth,
          mapHeight,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to join game: ${response.statusText}`);
      }

      const joinData = await response.json();

      if (this.statusText) {
        this.statusText.setText('Joining game...');
        this.statusText.setColor('#00ff00');
      }

      // Start the game
      setTimeout(() => {
        this.scene.start('GameScene', {
          multiplayer: true,
          sessionId: this.sessionId,
          playerId: joinData.playerId,
          selectedCivId: this.selectedCivId,
          apiBaseUrl: this.apiBaseUrl,
        });
      }, 1000);
    } catch (error) {
      console.error('Failed to join game:', error);
      if (this.statusText) {
        this.statusText.setText(
          `Error: ${error instanceof Error ? error.message : 'Failed to join game'}`,
        );
        this.statusText.setColor('#ff0000');
      }
      if (joinButton) {
        joinButton.setInteractive({ useHandCursor: true });
      }
    }
  }
}

