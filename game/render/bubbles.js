import { TILE_SIZE } from '../data/constants.js';
import { EMOJI_BITMAP } from '../assets/assets.manifest.js';

export class BubbleLayer {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'bubble-layer';
    this.canvas.width = 1;
    this.canvas.height = 1;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    container.appendChild(this.canvas);
    this.messages = new Map();
    this.bitmap = new Image();
    this.bitmapLoaded = false;
    this.bitmap.src = EMOJI_BITMAP.image;
    this.bitmap.onload = () => {
      this.bitmapLoaded = true;
    };
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  showMessage(agent, symbol) {
    if (!symbol) return;
    const existing = this.messages.get(agent.id);
    if (existing && existing.symbol === symbol) return;
    this.messages.set(agent.id, { symbol, ttl: 60 });
  }

  update(agents) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = '12px sans-serif';
    for (const agent of agents) {
      const message = this.messages.get(agent.id);
      if (!message) continue;
      const x = agent.x * TILE_SIZE + TILE_SIZE / 2;
      const y = agent.y * TILE_SIZE - 4;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(x - TILE_SIZE * 0.5, y - TILE_SIZE * 0.9, TILE_SIZE, TILE_SIZE * 0.75);
      if (this.bitmapLoaded) {
        const index = EMOJI_BITMAP.codes.indexOf(message.symbol);
        const cellIndex = index >= 0 ? index : 0;
        const cols = EMOJI_BITMAP.columns || 1;
        const cellSize = EMOJI_BITMAP.cellSize || 1;
        const sx = (cellIndex % cols) * cellSize;
        const sy = Math.floor(cellIndex / cols) * cellSize;
        ctx.drawImage(
          this.bitmap,
          sx,
          sy,
          cellSize,
          cellSize,
          x - TILE_SIZE * 0.45,
          y - TILE_SIZE * 0.85,
          TILE_SIZE * 0.9,
          TILE_SIZE * 0.9,
        );
      } else {
        ctx.fillStyle = 'white';
        ctx.font = '12px sans-serif';
        ctx.fillText(message.symbol, x, y);
      }
      message.ttl -= 1;
      if (message.ttl <= 0) {
        this.messages.delete(agent.id);
      }
    }
  }
}
