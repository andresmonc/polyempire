import Phaser from 'phaser';
import { CAMERA_ZOOM, CAMERA_SCROLL_SPEED } from '@config/game';

/**
 * Handles camera controls (panning, zooming, dragging)
 */
export class CameraController {
  private scene: Phaser.Scene;
  private controls!: Phaser.Cameras.Controls.SmoothedKeyControl;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private cameraStartX = 0;
  private cameraStartY = 0;
  private pointerDownX = 0;
  private pointerDownY = 0;
  private hasMoved = false;
  private readonly DRAG_THRESHOLD = 5; // Pixels to move before starting drag

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Initialize camera controls
   */
  initialize(): void {
    this.scene.cameras.main.setZoom(CAMERA_ZOOM.DEFAULT);
    this.scene.cameras.main.centerOn(0, 0);

    // Keyboard panning controls
    const cursors = this.scene.input.keyboard!.createCursorKeys();
    const controlConfig = {
      camera: this.scene.cameras.main,
      left: cursors.left,
      right: cursors.right,
      up: cursors.up,
      down: cursors.down,
      acceleration: 0.04,
      drag: 0.0005,
      maxSpeed: CAMERA_SCROLL_SPEED,
    };
    this.controls = new Phaser.Cameras.Controls.SmoothedKeyControl(controlConfig);

    // Zooming controls
    this.scene.input.on(
      'wheel',
      (_pointer: any, _gameObjects: any, _deltaX: any, deltaY: number) => {
        const newZoom = this.scene.cameras.main.zoom - deltaY * 0.001;
        this.scene.cameras.main.setZoom(
          Phaser.Math.Clamp(newZoom, CAMERA_ZOOM.MIN, CAMERA_ZOOM.MAX),
        );
      },
    );

    // Click-and-drag camera panning
    this.setupCameraDrag();
  }

  /**
   * Update camera controls (call in scene update loop)
   */
  update(delta: number): void {
    this.controls?.update(delta);
  }

  /**
   * Get whether the camera is currently being dragged
   */
  isDraggingCamera(): boolean {
    return this.isDragging && this.hasMoved;
  }

  /**
   * Reset drag state (call when pointer is released)
   */
  resetDragState(): void {
    const wasDragging = this.isDragging && this.hasMoved;
    this.isDragging = false;
    if (!wasDragging) {
      this.hasMoved = false;
    }
  }

  private setupCameraDrag(): void {
    // Track pointer down
    this.scene.input.on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      // Start drag on middle mouse button immediately, or track for left-click/touch drag
      if (pointer.middleButtonDown()) {
        // Middle mouse button - start dragging immediately
        this.isDragging = true;
        this.dragStartX = pointer.x;
        this.dragStartY = pointer.y;
        this.cameraStartX = this.scene.cameras.main.scrollX;
        this.cameraStartY = this.scene.cameras.main.scrollY;
      } else if (pointer.leftButtonDown() || pointer.isDown) {
        // Left click or touch - track initial position, will start drag if moved
        this.isDragging = false;
        this.hasMoved = false;
        this.pointerDownX = pointer.x;
        this.pointerDownY = pointer.y;
        this.dragStartX = pointer.x;
        this.dragStartY = pointer.y;
        this.cameraStartX = this.scene.cameras.main.scrollX;
        this.cameraStartY = this.scene.cameras.main.scrollY;
      }
    });

    // Track pointer move
    this.scene.input.on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonDown()) {
        // Middle mouse button - always drag
        if (!this.isDragging) {
          this.isDragging = true;
          this.dragStartX = pointer.x;
          this.dragStartY = pointer.y;
          this.cameraStartX = this.scene.cameras.main.scrollX;
          this.cameraStartY = this.scene.cameras.main.scrollY;
        }
        
        const deltaX = this.dragStartX - pointer.x;
        const deltaY = this.dragStartY - pointer.y;
        
        this.scene.cameras.main.setScroll(
          this.cameraStartX + deltaX / this.scene.cameras.main.zoom,
          this.cameraStartY + deltaY / this.scene.cameras.main.zoom,
        );
      } else if (pointer.leftButtonDown() || pointer.isDown) {
        // Left click or touch - check if moved enough to start drag
        if (!this.isDragging) {
          const moveDistance = Math.sqrt(
            Math.pow(pointer.x - this.pointerDownX, 2) + 
            Math.pow(pointer.y - this.pointerDownY, 2)
          );
          
          if (moveDistance > this.DRAG_THRESHOLD) {
            // Moved enough - start dragging
            this.isDragging = true;
            this.hasMoved = true;
            // Update drag start to current position to avoid jump
            this.dragStartX = pointer.x;
            this.dragStartY = pointer.y;
            this.cameraStartX = this.scene.cameras.main.scrollX;
            this.cameraStartY = this.scene.cameras.main.scrollY;
          }
        }
        
        if (this.isDragging) {
          const deltaX = this.dragStartX - pointer.x;
          const deltaY = this.dragStartY - pointer.y;
          
          // Move camera by the drag delta (inverse because we want to drag the world, not the camera)
          this.scene.cameras.main.setScroll(
            this.cameraStartX + deltaX / this.scene.cameras.main.zoom,
            this.cameraStartY + deltaY / this.scene.cameras.main.zoom,
          );
        }
      }
    });

    // Track pointer up
    this.scene.input.on(Phaser.Input.Events.POINTER_UP, () => {
      this.resetDragState();
    });

    // Also handle pointer cancel (for touch events that get interrupted)
    if ('POINTER_CANCEL' in Phaser.Input.Events) {
      this.scene.input.on((Phaser.Input.Events as any).POINTER_CANCEL, () => {
        this.isDragging = false;
        this.hasMoved = false;
      });
    }
  }
}

