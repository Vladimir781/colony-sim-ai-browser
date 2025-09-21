import { TILE_SIZE } from '../data/constants.js';

export class BubbleLayer {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'bubble-layer';
    this.canvas.width = 1;
    this.canvas.height = 1;
    this.ctx = this.canvas.getContext('2d');
    container.appendChild(this.canvas);
    this.messages = new Map();
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
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (const agent of agents) {
      const message = this.messages.get(agent.id);
      if (!message) continue;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      const x = agent.x * TILE_SIZE + TILE_SIZE / 2;
      const y = agent.y * TILE_SIZE - 4;
      ctx.fillRect(x - 12, y - 18, 24, 16);
      ctx.fillStyle = 'white';
      ctx.fillText(message.symbol, x, y);
      message.ttl -= 1;
      if (message.ttl <= 0) {
        this.messages.delete(agent.id);
      }
    }
  }
}
