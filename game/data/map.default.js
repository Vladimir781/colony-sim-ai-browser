import { seededRandom } from '../utils/random.js';

const BIOME_TYPES = ['grass', 'forest', 'water', 'mountain'];

export function createDefaultMap({ width, height, seed }) {
  const rand = seededRandom(seed ?? 1);
  const tiles = new Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const r = rand();
      let type = 'grass';
      if (r > 0.85) type = 'water';
      else if (r > 0.6) type = 'forest';
      else if (r < 0.1) type = 'mountain';
      tiles[y * width + x] = {
        x,
        y,
        biome: type,
        resources: type === 'forest' ? 3 : type === 'mountain' ? 1 : 2,
        danger: type === 'water' ? 2 : 0,
      };
    }
  }
  return {
    width,
    height,
    seed,
    biomes: BIOME_TYPES,
    tiles,
  };
}

export const DEFAULT_MAP_INFO = {
  name: 'Gentle Meadow',
  description: 'Лёгкая карта для первых запусков.',
  seed: 1337,
  size: { width: 64, height: 64 },
};
