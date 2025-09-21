import { SPRITE_MANIFEST } from '../assets/assets.manifest.js';
import { TILE_SIZE } from '../data/constants.js';
import { drawGrid, drawHeatmap, drawDayNight } from './overlays.js';
import { BubbleLayer } from './bubbles.js';

const BIOME_COLORS = {
  grass: '#486c2b',
  forest: '#2d4d1a',
  water: '#264b7f',
  mountain: '#676767',
};

export class PixiApp {
  constructor({ containerId = 'game-root' } = {}) {
    this.container = document.getElementById(containerId) ?? document.body;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'game-canvas';
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.container.appendChild(this.canvas);
    this.bubbles = new BubbleLayer(this.container);
    this.sprite = new Image();
    this.spriteLoaded = false;
    this.sprite.src = SPRITE_MANIFEST.meta.image;
    this.sprite.onload = () => {
      this.spriteLoaded = true;
    };
    this.state = null;
    window.addEventListener('resize', () => this.fitToContainer());
  }

  fitToContainer() {
    if (!this.state) return;
    const width = this.state.world.width * TILE_SIZE;
    const height = this.state.world.height * TILE_SIZE;
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.bubbles.resize(width, height);
  }

  update(state) {
    this.state = state;
    this.fitToContainer();
    this.render();
  }

  render() {
    if (!this.state) return;
    const { ctx } = this;
    const { world, agents } = this.state;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = "#121b24";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const tile of this.state.worldTiles ?? []) {
      const color = BIOME_COLORS[tile.biome] ?? '#333';
      ctx.fillStyle = color;
      ctx.fillRect(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
    drawGrid(ctx, world);
    for (const agent of agents) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(
        agent.x * TILE_SIZE + TILE_SIZE / 2,
        agent.y * TILE_SIZE + TILE_SIZE / 2,
        TILE_SIZE / 3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(
        agent.lastAction.toString(),
        agent.x * TILE_SIZE + TILE_SIZE / 2,
        agent.y * TILE_SIZE + TILE_SIZE / 2 + 8,
      );
      if (agent.lastSymbol > 0) {
        const symbol = this.state.commsAlphabet?.[agent.lastSymbol] ?? '*';
        this.bubbles.showMessage(agent, symbol);
      }
    }
    drawHeatmap(ctx, agents);
    drawDayNight(ctx, world);
    this.bubbles.update(agents);
  }
}
