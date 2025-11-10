import Phaser from 'phaser';
import { CivilizationRegistry } from '@engine/civilization/Civilization';

/**
 * Scene for selecting a civilization before starting a new game.
 */
export interface BotConfig {
  civId: string;
  playerId: number;
}

export class CivilizationSelectionScene extends Phaser.Scene {
  private selectedCivId: string | null = null;
  private bots: BotConfig[] = [];
  private nextPlayerId = 1; // Player 0 is the human player

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

    // Bots section
    const botsTitle = this.add.text(width / 2, height - 250, 'Bots', {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial',
    });
    botsTitle.setOrigin(0.5, 0.5);

    const addBotButton = this.add.rectangle(
      width / 2 - 150,
      height - 200,
      200,
      50,
      0x4a4a4a,
      0.8,
    );
    addBotButton.setStrokeStyle(2, 0xffffff);
    addBotButton.setInteractive({ useHandCursor: true });

    const addBotText = this.add.text(width / 2 - 150, height - 200, '+ Add Bot', {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'Arial',
    });
    addBotText.setOrigin(0.5, 0.5);

    // Bot list container (scrollable area)
    const botListY = height - 150;
    const botListContainer = this.add.container(width / 2, botListY);

    const updateBotList = () => {
      botListContainer.removeAll(true);
      
      if (this.bots.length === 0) {
        const noBotsText = this.add.text(0, 0, 'No bots added', {
          fontSize: '18px',
          color: '#888888',
          fontFamily: 'Arial',
        });
        noBotsText.setOrigin(0.5, 0.5);
        botListContainer.add(noBotsText);
        return;
      }

      this.bots.forEach((bot, index) => {
        const botY = index * 40;
        const civ = registry.get(bot.civId);
        
        // Bot entry background
        const botBg = this.add.rectangle(0, botY, 400, 35, 0x3a3a3a, 0.8);
        botBg.setStrokeStyle(1, 0x666666);
        botListContainer.add(botBg);

        // Civilization name
        const botName = this.add.text(-150, botY, civ?.name || bot.civId, {
          fontSize: '18px',
          color: '#ffffff',
          fontFamily: 'Arial',
        });
        botName.setOrigin(0.5, 0.5);
        botListContainer.add(botName);

        // Color indicator
        if (civ) {
          const colorIndicator = this.add.rectangle(-50, botY, 15, 15, parseInt(civ.color, 16));
          colorIndicator.setStrokeStyle(1, 0xffffff);
          botListContainer.add(colorIndicator);
        }

        // Remove button
        const removeButton = this.add.rectangle(150, botY, 30, 20, 0xff4444, 0.8);
        removeButton.setStrokeStyle(1, 0xffffff);
        removeButton.setInteractive({ useHandCursor: true });
        botListContainer.add(removeButton);

        const removeText = this.add.text(150, botY, '×', {
          fontSize: '20px',
          color: '#ffffff',
          fontFamily: 'Arial',
        });
        removeText.setOrigin(0.5, 0.5);
        botListContainer.add(removeText);

        removeButton.on('pointerdown', () => {
          this.bots.splice(index, 1);
          updateBotList();
        });
      });
    };

    updateBotList();

    // Add bot handler
    addBotButton.on('pointerdown', () => {
      this.showBotSelectionMenu(registry, civilizations, updateBotList);
    });

    addBotButton.on('pointerover', () => {
      addBotButton.setFillStyle(0x5a5a5a, 0.9);
    });
    addBotButton.on('pointerout', () => {
      addBotButton.setFillStyle(0x4a4a4a, 0.8);
    });

    // Start Game button (only enabled when a civilization is selected)
    const startButtonY = height - 50;
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
    const startY = 180;
    const buttonSpacing = 90;
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
        // Pass selected civilization and bots to GameScene
        this.scene.start('GameScene', { 
          selectedCivId: this.selectedCivId,
          bots: this.bots,
        });
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

  private showBotSelectionMenu(
    registry: CivilizationRegistry,
    civilizations: ReturnType<CivilizationRegistry['getAll']>,
    onBotAdded: () => void,
  ) {
    const { width, height } = this.cameras.main;

    // Store modal elements for cleanup
    const modalElements: Phaser.GameObjects.GameObject[] = [];

    // Create modal background
    const modalBg = this.add.rectangle(width / 2, height / 2, width * 0.8, height * 0.7, 0x1a1a1a, 0.95);
    modalBg.setStrokeStyle(3, 0xffffff);
    modalBg.setInteractive();
    modalElements.push(modalBg);

    const modalTitle = this.add.text(width / 2, height / 2 - height * 0.3, 'Select Bot Civilization', {
      fontSize: '36px',
      color: '#ffffff',
      fontFamily: 'Arial',
    });
    modalTitle.setOrigin(0.5, 0.5);
    modalElements.push(modalTitle);

    // Create civilization buttons in modal
    const startY = height / 2 - height * 0.2;
    const buttonSpacing = 80;
    const buttonWidth = 350;
    const buttonHeight = 60;

    const closeModal = () => {
      modalElements.forEach(element => element.destroy());
    };

    civilizations.forEach((civ, index) => {
      // Skip if this is the player's selected civ or already used by a bot
      if (civ.id === this.selectedCivId || this.bots.some(bot => bot.civId === civ.id)) {
        return;
      }

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
      modalElements.push(buttonBg);

      // Civilization name
      const civName = this.add.text(buttonX, buttonY - 10, civ.name, {
        fontSize: '24px',
        color: '#ffffff',
        fontFamily: 'Arial',
      });
      civName.setOrigin(0.5, 0.5);
      modalElements.push(civName);

      // Civilization color indicator
      const colorIndicator = this.add.rectangle(
        buttonX - buttonWidth / 2 + 30,
        buttonY,
        20,
        20,
        parseInt(civ.color, 16),
      );
      colorIndicator.setStrokeStyle(1, 0xffffff);
      modalElements.push(colorIndicator);

      // Hover effects
      buttonBg.on('pointerover', () => {
        buttonBg.setFillStyle(0x5a5a5a, 0.9);
        buttonBg.setStrokeStyle(2, parseInt(civ.color, 16));
      });
      buttonBg.on('pointerout', () => {
        buttonBg.setFillStyle(0x4a4a4a, 0.8);
        buttonBg.setStrokeStyle(2, 0xffffff);
      });

      // Click handler
      buttonBg.on('pointerdown', () => {
        // Add bot
        this.bots.push({
          civId: civ.id,
          playerId: this.nextPlayerId++,
        });
        
        // Close modal
        closeModal();
        onBotAdded();
      });
    });

    // Close button
    const closeButton = this.add.rectangle(width / 2, height / 2 + height * 0.25, 150, 50, 0x666666, 0.8);
    closeButton.setStrokeStyle(2, 0xffffff);
    closeButton.setInteractive({ useHandCursor: true });
    modalElements.push(closeButton);

    const closeText = this.add.text(width / 2, height / 2 + height * 0.25, 'Cancel', {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'Arial',
    });
    closeText.setOrigin(0.5, 0.5);
    modalElements.push(closeText);

    closeButton.on('pointerdown', closeModal);
    closeButton.on('pointerover', () => {
      closeButton.setFillStyle(0x777777, 0.9);
    });
    closeButton.on('pointerout', () => {
      closeButton.setFillStyle(0x666666, 0.8);
    });
  }
}

