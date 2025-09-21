const http = require('http');
const fs = require('fs');
const path = require('path');

const DEFAULT_PORT = 4173;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
};

const rootDir = path.resolve(__dirname, '..');

function printHelp() {
  console.log(`Usage: node tools/dev-server.js [options]\n\n` +
    `Options:\n` +
    `  -p, --port <number>  Port to listen on (default ${DEFAULT_PORT})\n` +
    `  -h, --help           Show this help message\n\n` +
    `You can also set the PORT environment variable.`);
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0 || port >= 65536) {
    return null;
  }
  return port;
}

function resolvePort() {
  let port = parsePort(process.env.PORT) ?? DEFAULT_PORT;
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg === '--port' || arg === '-p') {
      const next = args[i + 1];
      const parsed = parsePort(next);
      if (parsed == null) {
        console.error(`Invalid port: ${next ?? '<missing>'}`);
        process.exit(1);
      }
      port = parsed;
      i += 1;
      continue;
    }

    if (arg.startsWith('--port=')) {
      const value = arg.slice('--port='.length);
      const parsed = parsePort(value);
      if (parsed == null) {
        console.error(`Invalid port: ${value}`);
        process.exit(1);
      }
      port = parsed;
      continue;
    }

    const parsed = parsePort(arg);
    if (parsed != null) {
      port = parsed;
      continue;
    }

    console.error(`Unknown argument: ${arg}`);
    printHelp();
    process.exit(1);
  }

  return port;
}

function sendError(res, statusCode, message) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
}

async function handleRequest(req, res) {
  if (!req.url) {
    sendError(res, 400, 'Bad Request');
    return;
  }

  if (!['GET', 'HEAD'].includes(req.method ?? '')) {
    sendError(res, 405, 'Method Not Allowed');
    return;
  }

  try {
    const requestUrl = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(requestUrl.pathname);

    if (pathname === '/' || pathname === '') {
      pathname = 'index.html';
    } else {
      pathname = pathname.replace(/^\/+/, '');
    }

    const normalizedPath = path.normalize(pathname);
    if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
      sendError(res, 403, 'Forbidden');
      return;
    }

    let filePath = path.join(rootDir, normalizedPath);
    let stats;

    try {
      stats = await fs.promises.stat(filePath);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        sendError(res, 404, 'Not Found');
        return;
      }
      throw error;
    }

    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      try {
        stats = await fs.promises.stat(filePath);
      } catch (error) {
        if (error && error.code === 'ENOENT') {
          sendError(res, 404, 'Not Found');
          return;
        }
        throw error;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache');

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on('error', (error) => {
      console.error('Failed to read file:', error);
      if (!res.headersSent) {
        sendError(res, 500, 'Internal Server Error');
      } else {
        res.destroy(error);
      }
    });
    stream.pipe(res);
  } catch (error) {
    console.error('Unexpected server error:', error);
    if (!res.headersSent) {
      sendError(res, 500, 'Internal Server Error');
    } else {
      res.destroy(error);
    }
  }
}

function startServer(port = resolvePort()) {
  const server = http.createServer((req, res) => {
    handleRequest(req, res);
  });

  server.listen(port, () => {
    console.log(`Development server running at http://localhost:${port}`);
    console.log('Press Ctrl+C to stop.');
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
