#!/usr/bin/env node
/**
 * Convert binary assets (images, fonts) into inline data URI ES modules.
 *
 * Usage:
 *   node tools/asset2b64.js <input-file> [output-file] [exportName]
 *
 * Examples:
 *   node tools/asset2b64.js game/assets/spritesheet.png game/assets/spritesheet.b64.js SPRITESHEET_B64
 *   node tools/asset2b64.js game/assets/emoji.png >> tmp_module.js
 */
const fs = require('fs/promises');
const path = require('path');

const MIME_MAP = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

function toExportName(file, ext) {
  const base = path.basename(file, ext).replace(/[^a-zA-Z0-9]+/g, '_');
  const upper = base.toUpperCase();
  return upper.endsWith('_B64') ? upper : `${upper}_B64`;
}

async function main() {
  const [input, output, explicitName] = process.argv.slice(2);
  if (!input) {
    console.error('Usage: node tools/asset2b64.js <input-file> [output-file] [exportName]');
    process.exit(1);
  }

  const resolved = path.resolve(input);
  const ext = path.extname(resolved).toLowerCase();
  const mime = MIME_MAP[ext] ?? 'application/octet-stream';
  const exportName = explicitName ?? toExportName(resolved, ext);
  const data = await fs.readFile(resolved);
  const base64 = data.toString('base64');
  const moduleSource = `export const ${exportName} = "data:${mime};base64,${base64}";\n`;

  if (output) {
    await fs.writeFile(path.resolve(output), moduleSource);
  } else {
    process.stdout.write(moduleSource);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
