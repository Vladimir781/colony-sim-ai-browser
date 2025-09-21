import { createDefaultMap } from '../data/map.default.js';
import { GRID_SIZE, RESOURCE_TYPES } from '../data/constants.js';
import { seededRandom, randomChoice } from '../utils/random.js';

export class World {
  constructor({ width = GRID_SIZE, height = GRID_SIZE, seed = 1 } = {}) {
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

  harvest(tile, amount = 1) {
    const resource = tile.biome === 'forest' ? 'wood' : 'food';
    if (tile.resources <= 0) return 0;
    const taken = Math.min(tile.resources, amount);
    tile.resources -= taken;
    this.resources[resource] += taken;
    return taken;
  }

  dropResource(tile, resource, amount = 1) {
    tile.resources += amount;
    this.resources[resource] = Math.max(0, this.resources[resource] - amount);
  }

  tick(delta) {
    this.timeOfDay = (this.timeOfDay + delta) % 300;
  }
}
