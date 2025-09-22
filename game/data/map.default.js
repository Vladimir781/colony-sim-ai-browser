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
      const baseResources =
        type === 'forest' ? 4 : type === 'mountain' ? 2 : type === 'water' ? 1 : 3;
      const baseDanger = type === 'water' ? 2 : type === 'mountain' ? 1 : type === 'forest' ? 0.4 : 0.2;
      tiles[y * width + x] = {
        x,
        y,
        biome: type,
        resources: baseResources,
        maxResources: baseResources + 2,
        danger: baseDanger,
        fertility: type === 'grass' || type === 'forest' ? 1 : 0.4,
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
