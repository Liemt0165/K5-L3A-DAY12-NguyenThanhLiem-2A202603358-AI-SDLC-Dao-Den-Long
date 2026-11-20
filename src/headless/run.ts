import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { addLeaderboardEntry, loadLeaderboard, type LeaderboardEntry } from './leaderboardStore.js';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function parseArg(argv: string[], flag: string): string | undefined {
  const idx = argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < argv.length) {
    return argv[idx + 1];
  }
  return undefined;
}

function main(): void {
  const argv = process.argv.slice(2);
  const exportPath = parseArg(argv, '--export-leaderboard');
  if (exportPath) {
    const data = loadLeaderboard();
    const outAbs = path.resolve(process.cwd(), exportPath);
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    fs.writeFileSync(outAbs, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    process.stdout.write(`Exported ${data.entries.length} leaderboard entries to ${exportPath}\n`);
    process.exit(0);
  }

  const port = Number(parseArg(argv, '--port') ?? '4173');
  const distDir = path.resolve(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) {
    process.stderr.write('dist/ directory not found. Run "npm run build" first.\n');
    process.exit(1);
  }

  const server = http.createServer((req, res) => {
    const urlPath = (req.url ?? '/').split('?')[0];

    if (urlPath === '/api/leaderboard') {
      if (req.method === 'GET') {
        const data = loadLeaderboard();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(data));
        return;
      }
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
          body += String(chunk);
        });
        req.on('end', () => {
          try {
            const entry = JSON.parse(body) as LeaderboardEntry;
            const saved = addLeaderboardEntry(entry);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(saved));
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: (err as Error).message }));
          }
        });
        return;
      }
    }

    let filePath = path.join(distDir, urlPath === '/' ? 'index.html' : urlPath);
    if (!filePath.startsWith(distDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  server.listen(port, '0.0.0.0', () => {
    process.stdout.write(`Đảo Đèn Lồng running at http://localhost:${port}\n`);
    process.stdout.write(`Press Ctrl+C to stop.\n`);
  });
}

main();
