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
import { createTinyMLPFromBytes } from '../ai/models/tiny_mlp.js';
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
    case 'tiny-gru':
      return new TinyGRU({ weights: new Float32Array(BRAIN_DEFAULT) });
    case 'tiny-mlp':
    default:
      return createTinyMLPFromBytes(BRAIN_DEFAULT);
  }
}

function makeTraits(index) {
  const traits = [];
  traits.push(DEFAULT_AGENT_TRAITS[index % DEFAULT_AGENT_TRAITS.length]);
  if (index % 3 === 0) traits.push('curious');
  if (index % 5 === 0) traits.push('resilient');
  return traits;
}

export class Simulation {
  constructor(config = BASE_CONFIG) {
    this.config = JSON.parse(JSON.stringify(config));
    this.ecs = new ECS();
    this.world = new World({
      width: config.world.width,
      height: config.world.height,
      seed: config.world.seed,
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
      lastEvent: null,
      trainingTime: 0,
    };

    this.spawnAgents();
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
      } else {
        reward -= 0.02;
      }
    } else if (action === 'gather') {
      const tile = this.world.tileAt(agent.x, agent.y);
      const collected = this.world.harvest(tile, 1);
      agent.inventory.food += collected;
      reward += collected * 0.2;
    } else if (action === 'drop') {
      const tile = this.world.tileAt(agent.x, agent.y);
      if (agent.inventory.food > 0) {
        this.world.dropResource(tile, 'food', 1);
        agent.inventory.food -= 1;
        reward += 0.05;
      }
    } else if (action === 'rest') {
      agent.energy = Math.min(1, agent.energy + 0.1);
      reward += 0.03;
    } else if (action === 'signal') {
      reward -= 0.02;
    } else if (action === 'defend') {
      reward -= 0.01;
    } else if (action === 'explore') {
      reward += 0.01;
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
    for (let i = 0; i < agent.memory.length; i += 1) {
      const exp = agent.memory[i];
      const advantage = returns[i] - exp.baseline;
      const grad = agent.brain.computeGradients({
        actionIndex: exp.actionIndex,
        symbolIndex: exp.symbolIndex,
        advantage,
        targetValue: returns[i],
      });
      gradients.push(grad);
    }
    this.learner.update(agent.brain.params ?? agent.brain.serialize(), gradients);
    agent.memory = [];
    this.metrics.trainingTime += performance.now() - start;
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
      if (this.tick % this.config.brains.updateFrequency === 0) {
        this.learn(agent);
      }
    }

    const event = this.storyteller.tick(1, this.world, this.ecs);
    if (event) {
      this.metrics.lastEvent = event;
    }
    this.metrics.avgEnergy = energySum / this.agents.length;
    this.metrics.avgSatiety = satietySum / this.agents.length;
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
      },
    };
  }
}
