import { PixiApp } from './render/pixi_app.js';
import { ControlPanel } from './panel/panel.js';
import { BASE_CONFIG } from './data/config.js';
import { MESSAGE_TYPES } from './types.js';
import { Simulation } from './core/sim.js';
import { serializeSnapshot, applySnapshot } from './storage/snapshot.js';
import { getStorage } from './storage/idb.js';

const CONFIG_STORAGE_KEY = 'colony-sim-config';

function loadSavedConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return BASE_CONFIG;
    const parsed = JSON.parse(raw);
    return { ...BASE_CONFIG, ...parsed };
  } catch (error) {
    console.warn('Не удалось загрузить конфиг', error);
    return BASE_CONFIG;
  }
}

function persistConfig(config) {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.warn('Не удалось сохранить конфиг', error);
  }
}

class InlineWorker {
  constructor() {
    this.listeners = new Set();
    this.simulation = null;
    this.running = false;
    this.timer = null;
    this.tickInterval = 1000 / BASE_CONFIG.tickRate;
  }

  addEventListener(type, callback) {
    if (type === 'message') this.listeners.add(callback);
  }

  removeEventListener(type, callback) {
    if (type === 'message') this.listeners.delete(callback);
  }

  dispatch(type, payload) {
    for (const callback of this.listeners) {
      callback({ data: { type, payload } });
    }
  }

  ensureSimulation(config) {
    if (!this.simulation) {
      this.simulation = new Simulation(config ?? BASE_CONFIG);
    }
    return this.simulation;
  }

  startLoop() {
    if (this.running) return;
    this.running = true;
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.simulation.step();
      this.sendState();
    }, this.tickInterval);
  }

  stopLoop() {
    this.running = false;
    clearInterval(this.timer);
  }

  async handleMessage(message) {
    const { type, payload } = message;
    switch (type) {
      case MESSAGE_TYPES.INIT: {
        const config = payload?.config ? { ...BASE_CONFIG, ...payload.config } : BASE_CONFIG;
        this.ensureSimulation(config);
        this.tickInterval = 1000 / (config.tickRate ?? BASE_CONFIG.tickRate);
        this.sendState();
        break;
      }
      case 'simulation:start':
        this.startLoop();
        this.sendState();
        break;
      case 'simulation:pause':
        this.stopLoop();
        this.sendState();
        break;
      case 'settings:update':
        if ('thinkEvery' in payload) this.simulation.setThinkEvery(payload.thinkEvery);
        if ('allowLearning' in payload) this.simulation.setLearningEnabled(payload.allowLearning);
        if ('brainModel' in payload) this.simulation.setBrainModel(payload.brainModel);
        if ('tickRate' in payload) {
          this.tickInterval = 1000 / payload.tickRate;
          if (this.running) {
            this.stopLoop();
            this.startLoop();
          }
        }
        this.sendState();
        break;
      case 'storage:save': {
        const storage = await getStorage();
        const result = await storage.saveSnapshot(serializeSnapshot(this.simulation));
        this.dispatch(MESSAGE_TYPES.STORAGE_RESULT, { action: 'save', result });
        break;
      }
      case 'storage:load': {
        const storage = await getStorage();
        const snapshot = await storage.loadLatestSnapshot();
        if (snapshot) {
          applySnapshot(this.simulation, snapshot);
          this.sendState({ storageMessage: 'Сейв загружен' });
        } else {
          this.sendState({ storageMessage: 'Нет сохранённых данных' });
        }
        break;
      }
      case 'brains:export': {
        const brains = this.simulation.agents.map((agent) => ({
          agentId: agent.id,
          weights: Array.from(agent.brain.serialize()),
        }));
        const data = JSON.stringify({ version: this.simulation.config.version ?? '0.1.0', brains });
        this.dispatch(MESSAGE_TYPES.STORAGE_RESULT, { action: 'brains:export', data });
        break;
      }
      case 'brains:import': {
        try {
          const parsed = JSON.parse(payload);
          if (!parsed?.brains) throw new Error('Некорректный файл');
          for (const entry of parsed.brains) {
            const agent = this.simulation.agents.find((a) => a.id === entry.agentId);
            if (agent && entry.weights) {
              agent.brain.loadWeights(new Float32Array(entry.weights));
            }
          }
          this.sendState({ storageMessage: 'Мозги импортированы' });
        } catch (error) {
          this.dispatch(MESSAGE_TYPES.ERROR, error.message);
        }
        break;
      }
      default:
        break;
    }
  }

  sendState(extra = {}) {
    if (!this.simulation) return;
    const snapshot = this.simulation.snapshot();
    this.dispatch(MESSAGE_TYPES.STATE, {
      ...snapshot,
      config: this.simulation.config,
      isRunning: this.running,
      ...extra,
    });
  }

  postMessage(message) {
    void this.handleMessage(message);
  }
}

async function createSimulationWorker() {
  try {
    return new Worker(new URL('./worker/worker.entry.js', import.meta.url), { type: 'module' });
  } catch (error) {
    console.warn('Не удалось создать модульный воркер, используем фолбэк', error);
    return new InlineWorker();
  }
}

const renderApp = new PixiApp({ containerId: 'game-root' });
let worker = null;
const pendingMessages = [];
const latestState = {
  tick: 0,
  agents: [],
  world: BASE_CONFIG.world,
  comms: [],
  metrics: {},
  config: BASE_CONFIG,
  isRunning: false,
};

const panel = new ControlPanel({
  containerId: 'panel-root',
  onCommand: (type, payload) => {
    if (!worker) {
      pendingMessages.push({ type, payload });
      return;
    }
    worker.postMessage({ type, payload });
  },
});

function handleWorkerMessage(event) {
  const { type, payload } = event.data;
  switch (type) {
    case MESSAGE_TYPES.STATE: {
      Object.assign(latestState, payload);
      if (!latestState.commsAlphabet) {
        latestState.commsAlphabet = BASE_CONFIG.comms.alphabet.split('');
      }
      persistConfig(latestState.config);
      renderApp.update({ ...latestState, commsAlphabet: latestState.commsAlphabet });
      panel.update(latestState);
      break;
    }
    case MESSAGE_TYPES.STORAGE_RESULT: {
      if (payload.action === 'brains:export') {
        const blob = new Blob([payload.data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'brains.json';
        a.click();
        URL.revokeObjectURL(url);
      } else if (payload.result?.message) {
        latestState.storageMessage = payload.result.message;
        panel.update(latestState);
      }
      break;
    }
    case MESSAGE_TYPES.ERROR: {
      console.error('Ошибка симуляции', payload);
      latestState.storageMessage = String(payload);
      panel.update(latestState);
      break;
    }
    default:
      break;
  }
}

createSimulationWorker().then((createdWorker) => {
  worker = createdWorker;
  worker.addEventListener('message', handleWorkerMessage);
  worker.postMessage({ type: MESSAGE_TYPES.INIT, payload: { config: loadSavedConfig() } });
  while (pendingMessages.length) {
    const message = pendingMessages.shift();
    worker.postMessage(message);
  }
});
