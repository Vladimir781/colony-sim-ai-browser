import { BASE_CONFIG } from '../data/config.js';

export function serializeSnapshot(simulation) {
  const snapshot = simulation.snapshot();
  return {
    version: BASE_CONFIG.version,
    createdAt: Date.now(),
    data: snapshot,
  };
}

export function applySnapshot(simulation, snapshot) {
  if (!snapshot?.data) return false;
  const { world, agents } = snapshot.data;
  simulation.world.resources = { ...simulation.world.resources, ...world.resources };
  simulation.world.timeOfDay = world.timeOfDay;
  simulation.agents.forEach((agent, index) => {
    const saved = agents[index];
    if (!saved) return;
    agent.x = saved.x;
    agent.y = saved.y;
    agent.energy = saved.energy;
    agent.satiety = saved.satiety;
    agent.inventory = saved.inventory;
  });
  simulation.tick = snapshot.data.tick;
  return true;
}
