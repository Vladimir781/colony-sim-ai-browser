#!/usr/bin/env node
const fs = require('fs/promises');
const path = require('path');

const GAME_ROOT = path.resolve(__dirname, '..', 'game');
const OUTPUT_IMPORTMAP = path.resolve(__dirname, '..', 'importmap.generated.json');

const ENTRY_MODULES = ['main.js', 'worker/worker.entry.js'];
const MODULE_PREFIX = 'app/';

const moduleSources = new Map();

function isRelative(spec) {
  return spec.startsWith('./') || spec.startsWith('../');
}

function toCanonical(relPath) {
  return MODULE_PREFIX + relPath.replace(/\\/g, '/');
}

function resolveImport(fromPath, spec) {
  const fromDir = path.posix.dirname(fromPath.replace(/\\/g, '/'));
  const normalized = path.posix.normalize(path.posix.join(fromDir, spec));
  return normalized;
}

async function readModule(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  if (moduleSources.has(normalized)) {
    return moduleSources.get(normalized);
  }
  const absolutePath = path.resolve(GAME_ROOT, normalized);
  const code = await fs.readFile(absolutePath, 'utf8');
  const rewritten = await rewriteImports(normalized, code);
  moduleSources.set(normalized, rewritten);
  return rewritten;
}

async function rewriteImports(relPath, source) {
  let code = source;
  const importFromRegex = /import\s+([\s\S]*?)\s+from\s+['\"]([^'\"]+)['\"]/g;
  const importBareRegex = /import\s+['\"]([^'\"]+)['\"]/g;
  const dynamicImportRegex = /import\(\s*['\"]([^'\"]+)['\"]\s*\)/g;

  code = await replaceAsync(code, importFromRegex, async (match, clause, spec) => {
    if (!isRelative(spec)) return match;
    const resolved = resolveImport(relPath, spec);
    await readModule(resolved);
    const canonical = toCanonical(resolved);
    return match.replace(spec, canonical);
  });

  code = await replaceAsync(code, importBareRegex, async (match, spec) => {
    if (!isRelative(spec)) return match;
    const resolved = resolveImport(relPath, spec);
    await readModule(resolved);
    const canonical = toCanonical(resolved);
    return match.replace(spec, canonical);
  });

  code = await replaceAsync(code, dynamicImportRegex, async (match, spec) => {
    if (!isRelative(spec)) return match;
    const resolved = resolveImport(relPath, spec);
    await readModule(resolved);
    const canonical = toCanonical(resolved);
    return match.replace(spec, canonical);
  });

  return code;
}

async function replaceAsync(str, regex, asyncFn) {
  const promises = [];
  str.replace(regex, (...args) => {
    const promise = asyncFn(...args);
    promises.push({ promise, args });
    return '';
  });
  if (promises.length === 0) return str;
  const results = await Promise.all(promises.map((item) => item.promise));
  let result = str;
  for (let i = promises.length - 1; i >= 0; i -= 1) {
    const { args } = promises[i];
    const start = args[args.length - 2];
    const match = args[0];
    const end = start + match.length;
    result = result.slice(0, start) + results[i] + result.slice(end);
  }
  return result;
}

async function main() {
  for (const entry of ENTRY_MODULES) {
    await readModule(entry);
  }

  const sorted = Array.from(moduleSources.entries()).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const imports = {};
  for (const [relPath, code] of sorted) {
    const canonical = toCanonical(relPath);
    const base64 = Buffer.from(code, 'utf8').toString('base64');
    imports[canonical] = `data:text/javascript;base64,${base64}`;
  }

  // Alias for entry point
  if (imports[toCanonical('main.js')]) {
    imports['main.js'] = imports[toCanonical('main.js')];
  }

  const importMap = { imports };
  await fs.writeFile(OUTPUT_IMPORTMAP, JSON.stringify(importMap, null, 2), 'utf8');
  console.log(`Wrote import map with ${sorted.length} modules to ${path.relative(process.cwd(), OUTPUT_IMPORTMAP)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
