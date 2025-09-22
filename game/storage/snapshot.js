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
  const { world, agents, fauna, structures } = snapshot.data;
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
  if (structures) {
    simulation.world.structures = structures.map((structure) => ({ ...structure }));
    const maxId = simulation.world.structures.reduce((max, structure) => Math.max(max, structure.id ?? 0), 0);
    simulation.world.nextStructureId = maxId + 1;
  }
  if (fauna) {
    if (fauna.predators) {
      simulation.predators = fauna.predators.map((predator) => ({ ...predator }));
      const maxPredatorId = simulation.predators.reduce((max, predator) => Math.max(max, predator.id ?? 0), 0);
      simulation.nextPredatorId = maxPredatorId + 1;
    }
    if (fauna.herbivores) {
      simulation.herbivores = fauna.herbivores.map((herbivore) => ({ ...herbivore }));
      const maxHerbivoreId = simulation.herbivores.reduce((max, herbivore) => Math.max(max, herbivore.id ?? 0), 0);
      simulation.nextHerbivoreId = maxHerbivoreId + 1;
    }
  }
  simulation.tick = snapshot.data.tick;
  if (snapshot.data.progression && typeof simulation.progression?.load === 'function') {
    simulation.progression.load(snapshot.data.progression);
  }
  return true;
}
