import { SPRITESHEET_B64 } from './spritesheet.b64.js';
import { EMOJI_BITMAP_B64 } from './emoji_bitmap.b64.js';

export const SPRITE_MANIFEST = {
  version: 1,
  meta: {
    image: SPRITESHEET_B64,
    size: { w: 1, h: 1 },
    format: 'RGBA8888',
  },
  frames: {
    agent_idle: { frame: { x: 0, y: 0, w: 1, h: 1 } },
    agent_move: { frame: { x: 0, y: 0, w: 1, h: 1 } },
    resource_food: { frame: { x: 0, y: 0, w: 1, h: 1 } },
    structure_fire: { frame: { x: 0, y: 0, w: 1, h: 1 } },
  },
};

export const EMOJI_BITMAP = {
  image: EMOJI_BITMAP_B64,
  cellSize: 1,
  columns: 1,
  rows: 1,
  codes: ['🙂'],
};
