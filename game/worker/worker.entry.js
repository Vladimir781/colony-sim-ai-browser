import { Simulation } from '../core/sim.js';
import { BASE_CONFIG } from '../data/config.js';
import { MESSAGE_TYPES } from '../types.js';
import { serializeSnapshot, applySnapshot } from '../storage/snapshot.js';
import { getStorage } from '../storage/idb.js';

let simulation = null;
let running = false;
let timer = null;
let tickInterval = 1000 / BASE_CONFIG.tickRate;

function ensureSimulation(config) {
  if (!simulation) {
    simulation = new Simulation(config ?? BASE_CONFIG);
  }
  return simulation;
}

function startLoop() {
  if (running) return;
  running = true;
  clearInterval(timer);
  timer = setInterval(() => {
    try {
      simulation.step();
      sendState();
    } catch (error) {
      postMessage({ type: MESSAGE_TYPES.ERROR, payload: error.message });
    }
  }, tickInterval);
}

function stopLoop() {
  running = false;
  clearInterval(timer);
}

function sendState(extra = {}) {
  if (!simulation) return;
  const snapshot = simulation.snapshot();
  postMessage({
    type: MESSAGE_TYPES.STATE,
    payload: {
      ...snapshot,
      config: simulation.config,
      isRunning: running,
      ...extra,
    },
  });
}

async function handleSave() {
  const storage = await getStorage();
  const serialized = serializeSnapshot(simulation);
  const result = await storage.saveSnapshot(serialized);
  postMessage({
    type: MESSAGE_TYPES.STORAGE_RESULT,
    payload: { action: 'save', result },
  });
}

async function handleLoad() {
  const storage = await getStorage();
  const snapshot = await storage.loadLatestSnapshot();
  if (snapshot) {
    applySnapshot(simulation, snapshot);
    sendState({ storageMessage: 'Сейв загружен' });
  } else {
    sendState({ storageMessage: 'Нет сохранённых данных' });
  }
}

async function handleExportBrains() {
  const brains = simulation.agents.map((agent) => ({
    agentId: agent.id,
    weights: Array.from(agent.brain.serialize()),
  }));
  const data = JSON.stringify({ version: simulation.config.version ?? '0.1.0', brains });
  postMessage({
    type: MESSAGE_TYPES.STORAGE_RESULT,
    payload: { action: 'brains:export', data },
  });
}

async function handleImportBrains(payload) {
  try {
    const parsed = JSON.parse(payload);
    if (!parsed?.brains) throw new Error('Некорректный файл');
    for (const entry of parsed.brains) {
      const agent = simulation.agents.find((a) => a.id === entry.agentId);
      if (agent && entry.weights) {
        agent.brain.loadWeights(new Float32Array(entry.weights));
      }
    }
    sendState({ storageMessage: 'Мозги импортированы' });
  } catch (error) {
    postMessage({ type: MESSAGE_TYPES.ERROR, payload: error.message });
  }
}

self.addEventListener('message', async (event) => {
  const { type, payload } = event.data;
  switch (type) {
    case MESSAGE_TYPES.INIT: {
      const config = payload?.config ? { ...BASE_CONFIG, ...payload.config } : BASE_CONFIG;
      ensureSimulation(config);
      tickInterval = 1000 / (config.tickRate ?? BASE_CONFIG.tickRate);
      sendState();
      break;
    }
    case 'simulation:start':
      startLoop();
      sendState();
      break;
    case 'simulation:pause':
      stopLoop();
      sendState();
      break;
    case 'settings:update':
      if ('thinkEvery' in payload) simulation.setThinkEvery(payload.thinkEvery);
      if ('allowLearning' in payload) simulation.setLearningEnabled(payload.allowLearning);
      if ('brainModel' in payload) simulation.setBrainModel(payload.brainModel);
      if ('tickRate' in payload) {
        tickInterval = 1000 / payload.tickRate;
        if (running) {
          stopLoop();
          startLoop();
        }
      }
      sendState();
      break;
    case 'storage:save':
      await handleSave();
      break;
    case 'storage:load':
      await handleLoad();
      break;
    case 'brains:export':
      await handleExportBrains();
      break;
    case 'brains:import':
      await handleImportBrains(payload);
      break;
    default:
      break;
  }
});

sendState();
