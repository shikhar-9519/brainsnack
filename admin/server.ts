import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  approve,
  readFeed,
  readQueue,
  readRejected,
  reject,
  removeFromFeed,
} from '../lib/store';

/**
 * Local-only review console. Bound to 127.0.0.1 with no auth on purpose: it is
 * a single-operator tool that edits files in this repo, and it must never be
 * reachable from anywhere else.
 */
const HOST = '127.0.0.1';
const PORT = Number(process.env.BRAINSNACK_ADMIN_PORT ?? 4319);
const CLIENT_DIR = path.resolve(process.cwd(), 'admin', 'dist');
const MAX_BODY_BYTES = 256 * 1024;

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);

  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  });

  res.end(payload);
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject_) => {
    let body = '';

    req.on('data', (chunk: Buffer) => {
      body += chunk.toString('utf8');

      if (body.length > MAX_BODY_BYTES) {
        req.destroy();
        reject_(new Error('Body too large'));
      }
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject_(error);
      }
    });
  });
}

function idsFrom(body: unknown): string[] {
  if (typeof body !== 'object' || body === null) {
    return [];
  }

  const ids = (body as { ids?: unknown }).ids;

  if (!Array.isArray(ids)) {
    return [];
  }

  return ids.filter((id): id is string => typeof id === 'string');
}

async function handleApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  route: string,
): Promise<void> {
  if (route === '/api/state' && req.method === 'GET') {
    const [queue, feed, rejected] = await Promise.all([
      readQueue(),
      readFeed(),
      readRejected(),
    ]);

    sendJson(res, 200, {
      queue,
      feed: feed.cards,
      feedGeneratedAt: feed.generatedAt,
      rejectedCount: rejected.length,
    });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const ids = idsFrom(await readBody(req));

  if (ids.length === 0) {
    sendJson(res, 400, { error: 'No ids supplied' });
    return;
  }

  const actions: Record<string, (values: string[]) => Promise<number>> = {
    '/api/approve': approve,
    '/api/reject': reject,
    '/api/remove': removeFromFeed,
  };

  const action = actions[route];

  if (!action) {
    sendJson(res, 404, { error: 'Unknown endpoint' });
    return;
  }

  const changed = await action(ids);

  sendJson(res, 200, { changed });
}

/** Serves the built client, refusing anything that escapes the dist folder. */
async function serveStatic(
  res: http.ServerResponse,
  route: string,
): Promise<void> {
  const relative = route === '/' ? 'index.html' : route.slice(1);

  const target = path.resolve(CLIENT_DIR, relative);

  if (!target.startsWith(CLIENT_DIR)) {
    res.writeHead(403);
    res.end();
    return;
  }

  try {
    const file = await fs.readFile(target);

    res.writeHead(200, {
      'content-type':
        CONTENT_TYPES[path.extname(target)] ?? 'application/octet-stream',
    });

    res.end(file);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found. Run: npm run admin:build');
  }
}

const server = http.createServer((req, res) => {
  const route = new URL(req.url ?? '/', `http://${HOST}`).pathname;

  const work = route.startsWith('/api/')
    ? handleApi(req, res, route)
    : serveStatic(res, route);

  work.catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);

    if (!res.headersSent) {
      sendJson(res, 500, { error: String(error) });
    }
  });
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`BrainSnack admin: http://${HOST}:${PORT}\n`);
});
