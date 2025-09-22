export const GRID_SIZE = 64;
export const TILE_SIZE = 16;
export const MAX_AGENTS = 128;
export const ACTIONS = [
  'idle',
  'move_north',
  'move_south',
  'move_east',
  'move_west',
  'gather',
  'drop',
  'rest',
  'signal',
  'build',
  'defend',
  'explore',
];
export const ACTION_COUNT = ACTIONS.length;
export const SYMBOL_COUNT = 32;
export const THINK_EVERY_OPTIONS = [1, 2, 4];
export const TILE_TYPES = ['grass', 'forest', 'water', 'mountain'];
export const RESOURCE_TYPES = ['food', 'wood', 'ore', 'crystal'];
export const DAY_LENGTH = 180;
export const NIGHT_LENGTH = 120;
export const EVENT_TYPES = ['storm', 'raid', 'drought', 'ritual'];

export const DEFAULT_AGENT_TRAITS = ['forager', 'builder', 'scout'];

export const FSM_BEHAVIORS = {
  idle: ['idle', 'explore'],
  alert: ['defend', 'signal'],
};

export const CREATURE_TYPES = ['herbivore', 'predator'];

export const STRUCTURE_TYPES = ['shelter'];
