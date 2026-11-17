// A tiny static server for the game during development: serves game/ on
// 127.0.0.1, nothing else, no directory listing. Usage:
//   node serve.ts [--port 8080]
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const gameRoot = fileURLToPath(new URL('./game/', import.meta.url));
const portFlag = process.argv.indexOf('--port');
const port = portFlag >= 0 ? Number(process.argv[portFlag + 1]) : 8080;
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Use --port 1..65535');

const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
};

const server = createServer((request, response) => {
  try {
    let pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const filename = resolve(gameRoot, '.' + pathname);
    if (!filename.startsWith(resolve(gameRoot) + sep)) {
      response.writeHead(403).end('Outside game root');
      return;
    }
    const stat = statSync(filename);
    if (!stat.isFile()) {
      response.writeHead(404).end('File required');
      return;
    }
    response.writeHead(200, {
      'Content-Type': types[extname(filename)] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-store',
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(filename).pipe(response);
  } catch {
    response.writeHead(404).end('File not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`ROOTBOUND ready at http://127.0.0.1:${port}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
