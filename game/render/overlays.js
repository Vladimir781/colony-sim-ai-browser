import { TILE_SIZE } from '../data/constants.js';

export function drawGrid(ctx, world) {
  const width = world.width * TILE_SIZE;
  const height = world.height * TILE_SIZE;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawHeatmap(ctx, agents) {
  ctx.save();
  ctx.globalAlpha = 0.2;
  for (const agent of agents) {
    const intensity = Math.max(0, Math.min(1, agent.energy));
    ctx.fillStyle = `rgba(255, 180, 0, ${intensity})`;
    ctx.beginPath();
    ctx.arc(
      agent.x * TILE_SIZE + TILE_SIZE / 2,
      agent.y * TILE_SIZE + TILE_SIZE / 2,
      TILE_SIZE,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
}

export function drawDayNight(ctx, world) {
  const phase = Math.sin((world.timeOfDay / 300) * Math.PI * 2);
  const darkness = (phase + 1) / 2;
  ctx.save();
  ctx.fillStyle = `rgba(0, 0, 40, ${0.3 * darkness})`;
  ctx.fillRect(0, 0, world.width * TILE_SIZE, world.height * TILE_SIZE);
  ctx.restore();
}
