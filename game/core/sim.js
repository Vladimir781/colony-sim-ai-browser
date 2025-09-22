import { ECS } from './ecs.js';
import { World } from './world.js';
import { CommunicationsChannel } from './comms.js';
import { Storyteller } from './storyteller.js';
import {
  ACTIONS,

  THINK_EVERY_OPTIONS,
  DEFAULT_AGENT_TRAITS,
} from '../data/constants.js';
import { BASE_CONFIG } from '../data/config.js';
import {
  createTinyMLPFromBytes,
  createTinyMLPWide,
  createTinyMLPDeep,
  createTinyMLPRandom,
} from '../ai/models/tiny_mlp.js';
import { TinyGRU } from '../ai/models/tiny_gru.js';
import { BRAIN_DEFAULT } from '../ai/brains/brain.default.u8arr.js';
import { ReinforceLearner } from '../ai/learn/reinforce.js';

function sampleFrom(probs, rand = Math.random) {
  let sum = 0;
  const threshold = rand();
  for (let i = 0; i < probs.length; i += 1) {
    sum += probs[i];
    if (threshold <= sum) return i;
  }
  return probs.length - 1;
}

function createBrain(model) {
  switch (model) {
    case 'tiny-mlp-wide':
      return createTinyMLPWide();
    case 'tiny-mlp-deep':
      return createTinyMLPDeep();
    case 'tiny-gru':
      return new TinyGRU({ weights: new Float32Array(BRAIN_DEFAULT) });
    case 'tiny-mlp':
      return createTinyMLPFromBytes(BRAIN_DEFAULT);
    default:
      return createTinyMLPRandom();
  }
}

function makeTraits(index) {
  const traits = [];
  traits.push(DEFAULT_AGENT_TRAITS[index % DEFAULT_AGENT_TRAITS.length]);
  if (index % 3 === 0) traits.push('curious');
  if (index % 5 === 0) traits.push('resilient');
  return traits;
}

function createTrainingState() {
  return {
    steps: 0,
    totalReward: 0,
    avgReward: 0,
    lastReward: 0,
    lastAction: 'idle',
    lastBaseline: 0,
    lastAdvantage: 0,
    updates: 0,
    lastUpdateMs: 0,
    lastBatchReward: 0,
    lastBatchSize: 0,
    lastGradientRms: 0,
    bufferSize: 0,
    recentRewards: [],
    recentReturns: [],
  };
}

const ACTION_INDEX = ACTIONS.reduce((acc, action, index) => {
  acc[action] = index;
  return acc;
}, {});

const MOVE_ACTIONS = ['move_north', 'move_south', 'move_east', 'move_west'];

const MOVE_VECTORS = {
  move_north: [0, -1],
  move_south: [0, 1],
  move_east: [1, 0],
  move_west: [-1, 0],
};

function manhattan(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

export class Simulation {
  constructor(config = BASE_CONFIG) {
    this.config = JSON.parse(JSON.stringify(config));
    this.ecs = new ECS();
    this.world = new World({
      width: config.world.width,
      height: config.world.height,
      seed: config.world.seed,
      structureDecayRate: config.structures?.durabilityLossPerTick ?? 0.001,
      resourceRegrowth: config.ecosystem?.resourceRegrowth ?? 0.02,
    });
    this.communications = new CommunicationsChannel({
      alphabet: config.comms.alphabet,
      cost: config.comms.messageCost,
    });
    this.storyteller = new Storyteller(config.storyteller);
    this.agents = [];
    this.tick = 0;
    this.learner = new ReinforceLearner({
      learningRate: config.brains.learningRate,
      gradientClip: config.brains.gradientClip,
    });
    this.metrics = {
      avgEnergy: 1,
      avgSatiety: 1,
      avgReward: 0,
      lastEvent: null,
      trainingTime: 0,
      lastTrainingMs: 0,
      lastBatchReward: 0,
      lastBatchSize: 0,
      lastGradientRms: 0,
      totalUpdates: 0,
      bufferSize: 0,
      predatorCount: 0,
      herbivoreCount: 0,
      structureCount: 0,
    };

    this.predators = [];
    this.herbivores = [];
    this.nextPredatorId = 1;
    this.nextHerbivoreId = 1;

    this.spawnAgents();
    this.spawnFauna();
  }

  spawnAgents() {
    const count = this.config.agents.count;
    for (let i = 0; i < count; i += 1) {
      const entity = this.ecs.createEntity();
      const tile = this.world.randomSpawnTile();
      const brain = createBrain(this.config.brains.model);
      const agent = {
        id: entity,
        entity,
        x: tile.x,
        y: tile.y,
        energy: 1,
        satiety: 1,
        thinkEvery: this.config.agents.thinkEvery,
        role: 'colonist',
        traits: makeTraits(i),
        brain,
        brainModel: this.config.brains.model,
        training: createTrainingState(),
        rewards: [],
        lastAction: 0,
        lastSymbol: 0,
        symbolCooldown: 0,
        useFSM: false,
        memory: [],
        inventory: { food: 0, wood: 0 },
        fsmState: 'idle',
        cooldown: 0,
      };
      this.agents.push(agent);
      this.ecs.addComponent(entity, 'agent', agent);
      this.ecs.addComponent(entity, 'position', { x: tile.x, y: tile.y });
    }
  }

  spawnFauna() {
    const faunaConfig = this.config.fauna ?? {};
    const herbCount = faunaConfig.herbivores ?? 0;
    const predatorCount = faunaConfig.predators ?? 0;
    for (let i = 0; i < herbCount; i += 1) {
      const tile = this.world.randomSpawnTile();
      this.herbivores.push(this.createHerbivore(tile.x, tile.y));
    }
    for (let i = 0; i < predatorCount; i += 1) {
      const tile = this.world.randomSpawnTile();
      this.predators.push(this.createPredator(tile.x, tile.y));
    }
  }

  createHerbivore(x, y) {
    const herbivore = {
      id: this.nextHerbivoreId,
      x,
      y,
      hunger: 1,
    };
    this.nextHerbivoreId += 1;
    return herbivore;
  }

  createPredator(x, y) {
    const predator = {
      id: this.nextPredatorId,
      x,
      y,
      hunger: 1,
      cooldown: 0,
    };
    this.nextPredatorId += 1;
    return predator;
  }

  findClosestPredator(agent) {
    let closest = null;
    let bestDistance = Infinity;
    for (const predator of this.predators) {
      const distance = manhattan(agent.x, agent.y, predator.x, predator.y);
      if (distance < bestDistance) {
        bestDistance = distance;
        closest = predator;
      }
    }
    if (!closest) return null;
    return { predator: closest, distance: bestDistance };
  }

  directionAwayFrom(agent, predator) {
    const dx = agent.x - predator.x;
    const dy = agent.y - predator.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return dx >= 0 ? 'move_east' : 'move_west';
    }
    return dy >= 0 ? 'move_south' : 'move_north';
  }

  instinctForAgent(agent) {
    const tile = this.world.tileAt(agent.x, agent.y);
    const predatorInfo = this.findClosestPredator(agent);
    if (predatorInfo) {
      if (predatorInfo.distance <= 1) return 'defend';
      if (predatorInfo.distance <= 3) {
        const direction = this.directionAwayFrom(agent, predatorInfo.predator);
        if (direction) return direction;
      }
    }
    if (agent.energy < 0.25) return 'rest';
    if (agent.inventory.wood >= (this.config.structures?.buildCost ?? 3) && !this.world.structureAt(agent.x, agent.y)) {
      return 'build';
    }
    if (agent.satiety < 0.4 && tile.resources > 0.2) {
      return 'gather';
    }
    if (tile.resources <= 0.2 && this.world.rand() < 0.3) {
      return MOVE_ACTIONS[Math.floor(this.world.rand() * MOVE_ACTIONS.length)];
    }
    return null;
  }

  applyInstincts(agent, actionIndex) {
    const instinct = this.instinctForAgent(agent);
    if (!instinct) return actionIndex;
    const override = ACTION_INDEX[instinct];
    if (typeof override === 'number') {
      return override;
    }
    return actionIndex;
  }

  moveCreature(creature, dx, dy) {
    const [nx, ny] = this.world.wrap(creature.x + dx, creature.y + dy);
    const tile = this.world.tileAt(nx, ny);
    if (!this.world.isPassable(tile)) return false;
    creature.x = nx;
    creature.y = ny;
    return true;
  }

  moveTowards(creature, targetX, targetY) {
    const dx = targetX - creature.x;
    const dy = targetY - creature.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.moveCreature(creature, Math.sign(dx), 0);
    } else if (dy !== 0) {
      this.moveCreature(creature, 0, Math.sign(dy));
    }
  }

  wanderCreature(creature, chance = 0.5) {
    if (this.world.rand() > chance) return;
    const move = MOVE_ACTIONS[Math.floor(this.world.rand() * MOVE_ACTIONS.length)];
    const [dx, dy] = MOVE_VECTORS[move];
    this.moveCreature(creature, dx, dy);
  }

  findPredatorTarget(predator, range) {
    let closestAgent = null;
    let closestAgentDist = Infinity;
    for (const agent of this.agents) {
      const distance = manhattan(agent.x, agent.y, predator.x, predator.y);
      if (distance < closestAgentDist && distance <= range) {
        closestAgent = agent;
        closestAgentDist = distance;
      }
    }
    if (closestAgent) {
      return { type: 'agent', agent: closestAgent, distance: closestAgentDist, x: closestAgent.x, y: closestAgent.y };
    }
    let closestHerbivore = null;
    let closestHerbivoreDist = Infinity;
    for (const herbivore of this.herbivores) {
      const distance = manhattan(herbivore.x, herbivore.y, predator.x, predator.y);
      if (distance < closestHerbivoreDist) {
        closestHerbivore = herbivore;
        closestHerbivoreDist = distance;
      }
    }
    if (closestHerbivore && closestHerbivoreDist <= range + 2) {
      return {
        type: 'herbivore',
        herbivore: closestHerbivore,
        distance: closestHerbivoreDist,
        x: closestHerbivore.x,
        y: closestHerbivore.y,
      };
    }
    return null;
  }

  resolvePredatorAttack(predator, agent) {
    const faunaConfig = this.config.fauna ?? {};
    const structuresConfig = this.config.structures ?? {};
    const safe = this.world.isSafeTile(agent.x, agent.y);
    const mitigation = safe ? structuresConfig.damageReduction ?? 0.15 : 0;
    const damage = Math.max(0.05, (faunaConfig.predatorDamage ?? 0.2) * (1 - mitigation));
    agent.energy = Math.max(0, agent.energy - damage);
    agent.satiety = Math.max(0, agent.satiety - damage * 0.5);
    predator.hunger = Math.min(1, predator.hunger + (faunaConfig.predatorFeast ?? 0.4) * 0.5);
    const tile = this.world.tileAt(agent.x, agent.y);
    tile.danger = Math.min(this.config.ecosystem?.maxDanger ?? 4, tile.danger + damage);
    if (safe) {
      const survived = this.world.damageStructure(agent.x, agent.y, structuresConfig.damageReduction ?? 0.1);
      predator.hunger = Math.max(0, predator.hunger - (structuresConfig.counterDamage ?? 0.05));
      if (!survived) {
        this.storyteller.record('structure_destroyed', 'Укрытие разрушено хищником', {
          impact: damage * 0.5,
          tick: this.tick,
        });
      }
    }
    this.storyteller.record('predator_attack', `Хищник атакует агента ${agent.id}`, {
      impact: damage,
      tick: this.tick,
    });
    if (agent.energy <= 0.01) {
      agent.energy = 0.05;
      agent.satiety = Math.max(agent.satiety, 0.1);
      this.storyteller.record('agent_injured', `Агент ${agent.id} тяжело ранен`, {
        impact: damage * 0.5,
        tick: this.tick,
      });
    }
  }

  consumeHerbivore(predator, herbivore) {
    this.herbivores = this.herbivores.filter((item) => item !== herbivore);
    predator.hunger = Math.min(1, predator.hunger + (this.config.fauna?.predatorFeast ?? 0.6));
    const tile = this.world.tileAt(predator.x, predator.y);
    tile.danger = Math.min(this.config.ecosystem?.maxDanger ?? 4, tile.danger + 0.2);
    this.storyteller.record('predator_feast', 'Хищник пожирает добычу', {
      impact: 0.04,
      tick: this.tick,
    });
  }

  updateHerbivores() {
    const faunaConfig = this.config.fauna ?? {};
    const newborns = [];
    for (const herbivore of this.herbivores) {
      herbivore.hunger = Math.max(0, herbivore.hunger - 0.01);
      this.wanderCreature(herbivore, 0.6);
      const tile = this.world.tileAt(herbivore.x, herbivore.y);
      if (tile.resources > 0 && this.world.rand() < (faunaConfig.herbivoreGrazeRate ?? 0.3)) {
        const eaten = this.world.harvest(tile, 0.5, { track: false });
        herbivore.hunger = Math.min(1, herbivore.hunger + eaten * 0.2);
        tile.danger = Math.max(0, tile.danger - 0.02);
      }
      if (
        herbivore.hunger > 0.8 &&
        this.herbivores.length + newborns.length < (faunaConfig.maxHerbivores ?? 20) &&
        this.world.rand() < (faunaConfig.herbivoreReproductionChance ?? 0.01)
      ) {
        newborns.push(this.createHerbivore(herbivore.x, herbivore.y));
      }
    }
    this.herbivores = this.herbivores.filter((herbivore) => herbivore.hunger > 0.05);
    this.herbivores.push(...newborns);
    if (this.herbivores.length < (faunaConfig.herbivores ?? 0) && this.world.rand() < 0.1) {
      const tile = this.world.randomSpawnTile();
      this.herbivores.push(this.createHerbivore(tile.x, tile.y));
    }
  }

  updatePredators() {
    const faunaConfig = this.config.fauna ?? {};
    const aggroRange = faunaConfig.predatorAggroRange ?? 6;
    const survivors = [];
    for (const predator of this.predators) {
      predator.hunger = Math.max(0, predator.hunger - 0.015);
      if (predator.cooldown > 0) predator.cooldown -= 1;
      const target = this.findPredatorTarget(predator, aggroRange);
      if (target && predator.cooldown <= 0) {
        if (target.distance <= 0) {
          if (target.type === 'agent') {
            this.resolvePredatorAttack(predator, target.agent);
          } else if (target.type === 'herbivore') {
            this.consumeHerbivore(predator, target.herbivore);
          }
          predator.cooldown = 2;
        } else {
          this.moveTowards(predator, target.x, target.y);
        }
      } else {
        this.wanderCreature(predator, 0.5);
      }
      const tile = this.world.tileAt(predator.x, predator.y);
      tile.danger = Math.min(this.config.ecosystem?.maxDanger ?? 4, tile.danger + 0.05);
      if (predator.hunger > 0.05) {
        survivors.push(predator);
      } else {
        this.storyteller.record('predator_starved', 'Хищник погиб от голода', {
          impact: 0.02,
          tick: this.tick,
        });
      }
    }
    this.predators = survivors;
    if (this.predators.length < (faunaConfig.predators ?? 0) && this.world.rand() < 0.05) {
      const tile = this.world.randomSpawnTile();
      const newcomer = this.createPredator(tile.x, tile.y);
      this.predators.push(newcomer);
      this.storyteller.record('predator_spawn', 'В экосистеме появился новый хищник', {
        impact: 0.03,
        tick: this.tick,
      });
    }
  }

  buildObservation(agent) {
    const obs = new Float32Array(128);
    obs[0] = agent.x / this.world.width;
    obs[1] = agent.y / this.world.height;
    obs[2] = agent.energy;
    obs[3] = agent.satiety;
    obs[4] = agent.inventory.food / 10;
    obs[5] = agent.inventory.wood / 10;
    const tile = this.world.tileAt(agent.x, agent.y);
    obs[10] = tile.resources / 10;
    obs[11] = tile.danger / 5;
    const thinkEveryIndex = THINK_EVERY_OPTIONS.indexOf(agent.thinkEvery);
    obs[12] = thinkEveryIndex / THINK_EVERY_OPTIONS.length;
    const timeNorm = this.world.timeOfDay / 300;
    obs[13] = timeNorm;
    const predatorInfo = this.findClosestPredator(agent);
    obs[14] = predatorInfo ? Math.min(1, predatorInfo.distance / ((this.config.fauna?.predatorAggroRange ?? 6) + 1)) : 1;
    const structure = this.world.structureAt(agent.x, agent.y);
    obs[15] = structure ? structure.durability : 0;
    obs[16] = Math.min(1, tile.danger / (this.config.ecosystem?.maxDanger ?? 4));

    for (let i = 0; i < agent.traits.length && i < 5; i += 1) {
      obs[20 + i] = 1;
    }
    return obs;
  }

  fsmPolicy(agent) {
    if (agent.cooldown > 0) {
      agent.cooldown -= 1;
      return { actionIndex: 0, symbolIndex: 0 };
    }
    if (agent.fsmState === 'idle') {
      if (agent.energy < 0.5) {
        agent.fsmState = 'rest';
        return { actionIndex: ACTIONS.indexOf('rest'), symbolIndex: 0 };
      }
      agent.fsmState = 'wander';
      return { actionIndex: ACTIONS.indexOf('explore'), symbolIndex: 0 };
    }
    if (agent.fsmState === 'wander') {
      agent.cooldown = 2;
      agent.fsmState = 'idle';
      return {
        actionIndex: ACTIONS.indexOf('move_north') + Math.floor(Math.random() * 4),
        symbolIndex: 0,
      };
    }
    return { actionIndex: 0, symbolIndex: 0 };
  }

  applyAction(agent, actionIndex) {
    const action = ACTIONS[actionIndex] ?? 'idle';
    let reward = -0.01;
    if (action.startsWith('move_')) {
      let [dx, dy] = [0, 0];
      if (action === 'move_north') dy = -1;
      else if (action === 'move_south') dy = 1;
      else if (action === 'move_east') dx = 1;
      else if (action === 'move_west') dx = -1;
      const [nx, ny] = this.world.wrap(agent.x + dx, agent.y + dy);
      const tile = this.world.tileAt(nx, ny);
      if (this.world.isPassable(tile)) {
        agent.x = nx;
        agent.y = ny;
        reward += 0.02;
        tile.danger = Math.max(0, tile.danger - 0.01);
      } else {
        reward -= 0.02;
      }
    } else if (action === 'gather') {
      const tile = this.world.tileAt(agent.x, agent.y);
      const collected = this.world.harvest(tile, 1);
      if (tile.biome === 'forest') {
        agent.inventory.wood += collected;
      } else {
        agent.inventory.food += collected;
      }
      reward += collected * 0.2;
      tile.danger = Math.max(0, tile.danger - 0.02);
    } else if (action === 'drop') {
      const tile = this.world.tileAt(agent.x, agent.y);
      if (agent.inventory.food > 0) {
        this.world.dropResource(tile, 'food', 1);
        agent.inventory.food -= 1;
        reward += 0.05;
      }
    } else if (action === 'rest') {
      const structure = this.world.structureAt(agent.x, agent.y);
      const boost = structure ? 0.18 : 0.1;
      agent.energy = Math.min(1, agent.energy + boost);
      reward += structure ? 0.06 : 0.03;
      if (structure) {
        this.world.reinforceStructure(agent.x, agent.y, 0.05);
      }
    } else if (action === 'signal') {
      reward -= 0.01;
    } else if (action === 'build') {
      const tile = this.world.tileAt(agent.x, agent.y);
      const structureConfig = this.config.structures ?? {};
      const existing = this.world.structureAt(agent.x, agent.y);
      if (existing) {
        const cost = structureConfig.reinforceCost ?? 1;
        if (agent.inventory.wood >= cost) {
          agent.inventory.wood -= cost;
          this.world.reinforceStructure(agent.x, agent.y, 0.2);
          reward += 0.2;
        } else {
          reward -= 0.04;
        }
      } else if (this.world.isPassable(tile)) {
        const cost = structureConfig.buildCost ?? 3;
        if (agent.inventory.wood >= cost) {
          agent.inventory.wood -= cost;
          this.world.addStructure({ x: agent.x, y: agent.y, builtBy: agent.id });
          tile.danger = Math.max(0, tile.danger - 0.3);
          reward += 0.3;
          this.storyteller.record('structure', `Агент ${agent.id} построил укрытие`, {
            impact: 0.04,
            tick: this.tick,
          });
        } else {
          reward -= 0.05;
        }
      }
    } else if (action === 'defend') {
      const predatorInfo = this.findClosestPredator(agent);
      if (predatorInfo && predatorInfo.distance <= 1) {
        predatorInfo.predator.hunger = Math.max(0, predatorInfo.predator.hunger - 0.1);
        reward += 0.05;
      } else {
        reward -= 0.01;
      }
    } else if (action === 'explore') {
      reward += 0.01;
      const tile = this.world.tileAt(agent.x, agent.y);
      tile.danger = Math.max(0, tile.danger - 0.01);
    }

    agent.energy = Math.max(0, agent.energy - 0.01);
    agent.satiety = Math.max(0, agent.satiety - 0.005);
    if (agent.satiety <= 0.2 && agent.inventory.food > 0) {
      agent.inventory.food -= 1;
      agent.satiety = 1;
      reward += 0.1;
    }
    if (agent.energy <= 0) {
      reward -= 0.5;
    }
    return reward;
  }

  processCommunication(agent, symbolIndex) {
    if (symbolIndex <= 0) return 0;
    const symbol = this.config.comms.alphabet[symbolIndex % this.config.comms.alphabet.length];
    return this.communications.send(agent.id, [symbol]);
  }

  autoThrottle() {
    if (this.agents.length > 40) {
      for (const agent of this.agents) {
        agent.thinkEvery = 2;
      }
    }
  }

  learn(agent) {
    if (!this.config.agents.allowLearning) return;
    if (!agent.memory.length) return;
    const start = performance.now();
    const returns = this.learner.computeReturns(agent.memory.map((m) => m.reward));
    const gradients = [];
    let sumReturns = 0;
    let sumAdvantage = 0;
    let sumBaseline = 0;
    let gradSq = 0;
    let gradCount = 0;
    for (let i = 0; i < agent.memory.length; i += 1) {
      const exp = agent.memory[i];
      const advantage = returns[i] - exp.baseline;
      sumReturns += returns[i];
      sumAdvantage += advantage;
      sumBaseline += exp.baseline;
      const grad = agent.brain.computeGradients({
        actionIndex: exp.actionIndex,
        symbolIndex: exp.symbolIndex,
        advantage,
        targetValue: returns[i],
      });
      gradients.push(grad);
      for (let j = 0; j < grad.length; j += 1) {
        const value = grad[j];
        gradSq += value * value;
        gradCount += 1;
      }
    }
    const weights = agent.brain.params ?? agent.brain.serialize();
    this.learner.update(weights, gradients);
    const duration = performance.now() - start;
    agent.memory = [];
    const batchCount = returns.length;
    const batchReward = batchCount ? sumReturns / batchCount : 0;
    const avgAdvantage = batchCount ? sumAdvantage / batchCount : 0;
    const avgBaseline = batchCount ? sumBaseline / batchCount : 0;
    const gradientRms = gradCount ? Math.sqrt(gradSq / gradCount) : 0;
    if (agent.training) {
      const training = agent.training;
      training.updates += 1;
      training.lastUpdateMs = duration;
      training.lastBatchReward = batchReward;
      training.lastBatchSize = batchCount;
      training.lastAdvantage = avgAdvantage;
      training.lastBaseline = avgBaseline;
      training.lastGradientRms = gradientRms;
      training.bufferSize = 0;
      if (!training.recentReturns) training.recentReturns = [];
      if (batchCount) {
        training.recentReturns.push(batchReward);
        if (training.recentReturns.length > 20) training.recentReturns.shift();
      }
    }
    this.metrics.trainingTime += duration;
    this.metrics.lastTrainingMs = duration;
    this.metrics.lastBatchReward = batchReward;
    this.metrics.lastBatchSize = batchCount;
    this.metrics.lastGradientRms = gradientRms;
  }

  step() {
    this.tick += 1;
    this.world.tick(1);
    this.autoThrottle();
    let energySum = 0;
    let satietySum = 0;

    for (const agent of this.agents) {
      energySum += agent.energy;
      satietySum += agent.satiety;
      if (this.tick % agent.thinkEvery !== 0) continue;
      const obs = this.buildObservation(agent);
      let actionIndex = 0;
      let symbolIndex = 0;
      let baseline = 0;
      if (agent.useFSM) {
        const decision = this.fsmPolicy(agent);
        actionIndex = decision.actionIndex;
        symbolIndex = decision.symbolIndex;
      } else {
        const { actionProbs, symbolProbs, baseline: predictedBaseline } = agent.brain.forward(obs);
        actionIndex = sampleFrom(actionProbs, this.world.rand);
        symbolIndex = sampleFrom(symbolProbs, this.world.rand);
        baseline = predictedBaseline;
      }
      actionIndex = this.applyInstincts(agent, actionIndex);
      const reward = this.applyAction(agent, actionIndex);
      const commCost = this.processCommunication(agent, symbolIndex);
      const totalReward = reward - commCost;
      agent.lastAction = actionIndex;
      if (symbolIndex > 0) {
        agent.lastSymbol = symbolIndex;
        agent.symbolCooldown = 30;
      } else if (agent.symbolCooldown > 0) {
        agent.symbolCooldown -= 1;
        if (agent.symbolCooldown <= 0) {
          agent.lastSymbol = 0;
        }
      }
      agent.rewards.push(totalReward);
      agent.memory.push({
        actionIndex,
        symbolIndex,
        reward: totalReward,
        baseline,
      });
      if (agent.training) {
        const training = agent.training;
        training.steps += 1;
        training.totalReward += totalReward;
        training.avgReward = training.totalReward / training.steps;
        training.lastReward = totalReward;
        training.lastAction = ACTIONS[actionIndex] ?? 'idle';
        training.lastBaseline = baseline;
        training.lastAdvantage = totalReward - baseline;
        training.bufferSize = agent.memory.length;
        if (!training.recentRewards) training.recentRewards = [];
        training.recentRewards.push(totalReward);
        if (training.recentRewards.length > 30) training.recentRewards.shift();
      }
      if (this.tick % this.config.brains.updateFrequency === 0) {
        this.learn(agent);
      }
    }

    this.updateHerbivores();
    this.updatePredators();

    const event = this.storyteller.tick(1, this.world, this.ecs);
    if (event) {
      this.metrics.lastEvent = event;
    }
    const agentCount = this.agents.length || 1;
    this.metrics.avgEnergy = energySum / agentCount;
    this.metrics.avgSatiety = satietySum / agentCount;
    this.metrics.avgReward = this.agents.reduce(
      (sum, current) => sum + (current.training?.avgReward ?? 0),
      0,
    ) / agentCount;
    this.metrics.totalUpdates = this.agents.reduce(
      (sum, current) => sum + (current.training?.updates ?? 0),
      0,
    );
    this.metrics.bufferSize = this.agents.reduce(
      (sum, current) => sum + (current.training?.bufferSize ?? 0),
      0,
    );
    this.metrics.predatorCount = this.predators.length;
    this.metrics.herbivoreCount = this.herbivores.length;
    this.metrics.structureCount = this.world.structures.length;
  }

  setThinkEvery(value) {
    this.config.agents.thinkEvery = value;
    for (const agent of this.agents) {
      agent.thinkEvery = value;
    }
  }

  setLearningEnabled(enabled) {
    this.config.agents.allowLearning = enabled;
  }

  setBrainModel(model) {
    if (this.config.brains.model === model) return;
    this.config.brains.model = model;
    for (const agent of this.agents) {
      agent.brain = createBrain(model);
      agent.brainModel = model;
      agent.memory = [];
      agent.rewards = [];
      agent.training = createTrainingState();
    }
  }

  snapshot() {
    return {
      tick: this.tick,
      world: {
        width: this.world.width,
        height: this.world.height,
        timeOfDay: this.world.timeOfDay,
        resources: { ...this.world.resources },
      },
      worldTiles: this.world.tiles,
      agents: this.agents.map((agent) => ({
        id: agent.id,
        x: agent.x,
        y: agent.y,
        energy: agent.energy,
        satiety: agent.satiety,
        thinkEvery: agent.thinkEvery,
        role: agent.role,
        traits: agent.traits,
        lastAction: agent.lastAction,
        lastSymbol: agent.lastSymbol,
        inventory: agent.inventory,
        useFSM: agent.useFSM,
        brainModel: agent.brainModel ?? this.config.brains.model,
        training: agent.training
          ? {
              steps: agent.training.steps,
              totalReward: agent.training.totalReward,
              avgReward: agent.training.avgReward,
              lastReward: agent.training.lastReward,
              lastAction: agent.training.lastAction,
              lastBaseline: agent.training.lastBaseline,
              lastAdvantage: agent.training.lastAdvantage,
              updates: agent.training.updates,
              lastUpdateMs: agent.training.lastUpdateMs,
              lastBatchReward: agent.training.lastBatchReward,
              lastBatchSize: agent.training.lastBatchSize,
              lastGradientRms: agent.training.lastGradientRms,
              bufferSize: agent.training.bufferSize,
              recentRewards: [...agent.training.recentRewards],
              recentReturns: [...agent.training.recentReturns],
            }
          : null,
        brain: this.describeBrain(agent.brain, agent.brainModel ?? this.config.brains.model),
      })),
      fauna: {
        predators: this.predators.map((predator) => ({
          id: predator.id,
          x: predator.x,
          y: predator.y,
          hunger: predator.hunger,
        })),
        herbivores: this.herbivores.map((herbivore) => ({
          id: herbivore.id,
          x: herbivore.x,
          y: herbivore.y,
          hunger: herbivore.hunger,
        })),
      },
      structures: this.world.structures.map((structure) => ({
        id: structure.id,
        x: structure.x,
        y: structure.y,
        type: structure.type,
        durability: structure.durability,
        builtBy: structure.builtBy,
      })),
      comms: this.communications.recent(10),
      storyteller: {
        lastEvent: this.metrics.lastEvent,
        history: this.storyteller.history,
      },
      metrics: {
        avgEnergy: this.metrics.avgEnergy,
        avgSatiety: this.metrics.avgSatiety,
        trainingTime: this.metrics.trainingTime,
        avgReward: this.metrics.avgReward,
        totalUpdates: this.metrics.totalUpdates,
        lastTrainingMs: this.metrics.lastTrainingMs,
        lastBatchReward: this.metrics.lastBatchReward,
        lastBatchSize: this.metrics.lastBatchSize,
        lastGradientRms: this.metrics.lastGradientRms,
        bufferSize: this.metrics.bufferSize,
        predatorCount: this.metrics.predatorCount,
        herbivoreCount: this.metrics.herbivoreCount,
        structureCount: this.metrics.structureCount,
      },
    };
  }

  describeBrain(brain, model) {
    if (!brain || typeof brain.serialize !== 'function') {
      return {
        model,
        size: 0,
        preview: [],
        stats: { min: 0, max: 0, mean: 0, std: 0 },
      };
    }
    const weights = brain.serialize();
    const size = weights.length;
    if (!size) {
      return {
        model,
        size: 0,
        preview: [],
        stats: { min: 0, max: 0, mean: 0, std: 0 },
      };
    }
    const previewCount = Math.min(24, size);
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < size; i += 1) {
      const value = weights[i];
      if (value < min) min = value;
      if (value > max) max = value;
      sum += value;
      sumSq += value * value;
    }
    const mean = sum / size;
    const variance = Math.max(0, sumSq / size - mean * mean);
    return {
      model,
      size,
      preview: Array.from(weights.slice(0, previewCount)),
      stats: {
        min,
        max,
        mean,
        std: Math.sqrt(variance),
      },
    };
  }
}
