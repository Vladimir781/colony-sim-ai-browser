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
  constructor({ containerId = 'game-root', onAgentSelect } = {}) {
    this.container = document.getElementById(containerId) ?? document.body;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'game-canvas';
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.container.appendChild(this.canvas);
    this.bubbles = new BubbleLayer(this.container);
    this.onAgentSelect = onAgentSelect;
    this.sprite = new Image();
    this.spriteLoaded = false;
    this.sprite.src = SPRITE_MANIFEST.meta.image;
    this.sprite.onload = () => {
      this.spriteLoaded = true;
    };
    this.state = null;
    this.selectedAgentId = null;
    window.addEventListener('resize', () => this.fitToContainer());
    this.canvas.addEventListener('click', (event) => this.handleClick(event));
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

  setSelectedAgent(agentId) {
    if (this.selectedAgentId === agentId) return;
    this.selectedAgentId = agentId;
    if (this.state) {
      this.render();
    }
  }

  handleClick(event) {
    if (!this.state) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const tileX = Math.floor(x / TILE_SIZE);
    const tileY = Math.floor(y / TILE_SIZE);
    const agent = this.state.agents?.find((item) => item.x === tileX && item.y === tileY);
    if (agent) {
      this.onAgentSelect?.(agent.id);
    } else {
      this.onAgentSelect?.(null);
    }
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
    for (const structure of this.state.structures ?? []) {
      const x = structure.x * TILE_SIZE;
      const y = structure.y * TILE_SIZE;
      ctx.fillStyle = 'rgba(90, 140, 200, 0.8)';
      ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillRect(x + 2, y + TILE_SIZE - 3, (TILE_SIZE - 4) * Math.max(0, Math.min(1, structure.durability ?? 0)), 2);
    }
    for (const herbivore of this.state.fauna?.herbivores ?? []) {
      ctx.fillStyle = '#f9e79f';
      ctx.beginPath();
      ctx.arc(
        herbivore.x * TILE_SIZE + TILE_SIZE / 2,
        herbivore.y * TILE_SIZE + TILE_SIZE / 2,
        TILE_SIZE / 4,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    for (const predator of this.state.fauna?.predators ?? []) {
      const cx = predator.x * TILE_SIZE + TILE_SIZE / 2;
      const cy = predator.y * TILE_SIZE + TILE_SIZE / 2;
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.moveTo(cx, cy - TILE_SIZE / 3);
      ctx.lineTo(cx + TILE_SIZE / 3, cy + TILE_SIZE / 3);
      ctx.lineTo(cx - TILE_SIZE / 3, cy + TILE_SIZE / 3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(231, 76, 60, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, TILE_SIZE / 2.2, 0, Math.PI * 2);
      ctx.stroke();
    }
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
      if (agent.id === this.selectedAgentId) {
        ctx.strokeStyle = '#25bff2';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
          agent.x * TILE_SIZE + TILE_SIZE / 2,
          agent.y * TILE_SIZE + TILE_SIZE / 2,
          TILE_SIZE / 2.2,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
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
