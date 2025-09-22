/**
 * @typedef {Object} AgentState
 * @property {number} id
 * @property {number} x
 * @property {number} y
 * @property {number} energy
 * @property {number} satiety
 * @property {number} thinkEvery
 * @property {string} role
 * @property {string[]} traits
 * @property {import('./ai/models/tiny_mlp.js').TinyMLP|import('./ai/models/tiny_gru.js').TinyGRU|null} brain
 * @property {number[]} rewards
 * @property {number} lastAction
 * @property {number} lastSymbol
 * @property {boolean} useFSM
 * @property {{ food: number, wood: number }} inventory
 */

/**
 * @typedef {Object} WorldTile
 * @property {number} x
 * @property {number} y
 * @property {string} biome
 * @property {number} resources
 * @property {number} danger
 */

/**
 * @typedef {Object} SimulationSnapshot
 * @property {number} tick
 * @property {AgentState[]} agents
 * @property {WorldTile[]} tiles
 * @property {Object} resources
 * @property {Object} metrics
 * @property {{ predators: CreatureState[], herbivores: CreatureState[] }} fauna
 * @property {StructureState[]} structures
 */

/**
 * @typedef {Object} CreatureState
 * @property {number|string} id
 * @property {number} x
 * @property {number} y
 * @property {number} hunger
 */

/**
 * @typedef {Object} StructureState
 * @property {number} id
 * @property {number} x
 * @property {number} y
 * @property {string} type
 * @property {number} durability
 * @property {number|null} builtBy
 */

export const MESSAGE_TYPES = {
  INIT: 'init',
  STATE: 'state',
  PANEL_EVENT: 'panel:event',
  SIM_COMMAND: 'sim:command',
  STORAGE_RESULT: 'storage:result',
  ERROR: 'error',
};
