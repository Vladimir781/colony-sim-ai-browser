export const BASE_CONFIG = {
  version: '0.1.0',
  tickRate: 12,
  renderFps: 30,
  world: {
    width: 64,
    height: 64,
    seed: 1337,
    resourceDensity: 0.12,
  },
  agents: {
    count: 12,
    thinkEvery: 1,
    fsmFallback: false,
    allowLearning: true,
  },
  brains: {
    model: 'tiny-mlp',
    learningRate: 0.0005,
    updateFrequency: 10,
    gradientClip: 5,
    maxTrainingTimeMs: 2,
  },
  comms: {
    alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345',
    messageCost: 0.1,
    silenceCost: 0,
  },
  storyteller: {
    tensionBudget: 1,
    cooldownTicks: 30,
  },
};
