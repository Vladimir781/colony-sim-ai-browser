import { createDefaultMap } from '../data/map.default.js';
import { GRID_SIZE, RESOURCE_TYPES, STRUCTURE_TYPES } from '../data/constants.js';
import { seededRandom, randomChoice } from '../utils/random.js';

export class World {
  constructor({
    width = GRID_SIZE,
    height = GRID_SIZE,
    seed = 1,
    structureDecayRate = 0.001,
    resourceRegrowth = 0.02,
  } = {}) {
    this.width = width;
    this.height = height;
    this.seed = seed;
    this.rand = seededRandom(seed);
    this.tiles = createDefaultMap({ width, height, seed }).tiles;
    this.timeOfDay = 0;
    this.resources = RESOURCE_TYPES.reduce((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {});
    this.structures = [];
    this.nextStructureId = 1;
    this.structureDecayRate = structureDecayRate;
    this.resourceRegrowth = resourceRegrowth;
  }

  wrap(x, y) {
    const nx = (x + this.width) % this.width;
    const ny = (y + this.height) % this.height;
    return [nx, ny];
  }

  tileAt(x, y) {
    const [nx, ny] = this.wrap(x, y);
    return this.tiles[ny * this.width + nx];
  }

  isPassable(tile) {
    return tile.biome !== 'water';
  }

  randomSpawnTile() {
    for (let i = 0; i < this.tiles.length; i += 1) {
      const tile = randomChoice(this.tiles, this.rand);
      if (this.isPassable(tile)) return tile;
    }
    return this.tiles[0];
  }

  harvest(tile, amount = 1, { track = true } = {}) {
    const resource = tile.biome === 'forest' ? 'wood' : 'food';
    if (tile.resources <= 0) return 0;
    const taken = Math.min(tile.resources, amount);
    tile.resources -= taken;
    if (track) {
      this.resources[resource] += taken;
    }
    return taken;
  }

  dropResource(tile, resource, amount = 1) {
    tile.resources = Math.min(tile.maxResources ?? tile.resources + amount, tile.resources + amount);
    this.resources[resource] = Math.max(0, this.resources[resource] - amount);
  }

  structureAt(x, y) {
    return this.structures.find((structure) => structure.x === x && structure.y === y) ?? null;
  }

  addStructure({ x, y, type = STRUCTURE_TYPES[0], builtBy, durability = 1 }) {
    if (!STRUCTURE_TYPES.includes(type)) return null;
    const tile = this.tileAt(x, y);
    if (!this.isPassable(tile) || this.structureAt(x, y)) return null;
    const structure = {
      id: this.nextStructureId,
      x,
      y,
      type,
      durability: Math.min(1, durability),
      builtBy: builtBy ?? null,
      lastMaintained: this.timeOfDay,
    };
    this.nextStructureId += 1;
    this.structures.push(structure);
    return structure;
  }

  reinforceStructure(x, y, amount = 0.15) {
    const structure = this.structureAt(x, y);
    if (!structure) return null;
    structure.durability = Math.min(1, structure.durability + amount);
    structure.lastMaintained = this.timeOfDay;
    return structure;
  }

  damageStructure(x, y, amount = 0.1) {
    const structure = this.structureAt(x, y);
    if (!structure) return false;
    structure.durability = Math.max(0, structure.durability - amount);
    structure.lastMaintained = this.timeOfDay;
    if (structure.durability <= 0) {
      this.structures = this.structures.filter((item) => item.id !== structure.id);
      return false;
    }
    return true;
  }

  removeStructure(id) {
    this.structures = this.structures.filter((structure) => structure.id !== id);
  }

  isSafeTile(x, y) {
    const structure = this.structureAt(x, y);
    return Boolean(structure && structure.durability > 0.1);
  }

  regenerateTile(tile, rate = 0.1) {
    if (tile.biome === 'water') return;
    const max = tile.maxResources ?? 3;
    if (tile.resources >= max) return;
    const fertility = tile.fertility ?? 0.5;
    if (this.rand() < rate * fertility) {
      tile.resources = Math.min(max, tile.resources + 1);
    }
    tile.danger = Math.max(0, tile.danger - 0.01);
  }

  tick(delta) {
    this.timeOfDay = (this.timeOfDay + delta) % 300;
    if (this.structures.length) {
      for (const structure of this.structures) {
        structure.durability = Math.max(0, structure.durability - delta * this.structureDecayRate);
      }
      this.structures = this.structures.filter((structure) => structure.durability > 0.05);
    }
    if (this.rand() < 0.4) {
      const tile = randomChoice(this.tiles, this.rand);
      this.regenerateTile(tile, this.resourceRegrowth * delta);
    }
  }
}
