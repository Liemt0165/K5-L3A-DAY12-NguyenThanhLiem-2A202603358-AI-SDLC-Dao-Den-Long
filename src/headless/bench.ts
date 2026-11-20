import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

interface BenchArgs {
  seed: number;
  duration: number;
  outPath: string;
}

interface BrowserBenchMetrics {
  avg_fps: number;
  p1_low_fps: number;
  frame_ms_p95: number;
  frames: number;
  first_frame_rel_ms: number;
  renderer: string;
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function parseArgs(argv: string[]): BenchArgs {
  let seed = 42;
  let duration = 30;
  let outPath = 'bench.json';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const val = argv[i + 1];
    if (arg === '--seed' && val !== undefined) {
      seed = Number(val);
      i += 1;
    } else if (arg === '--duration' && val !== undefined) {
      duration = Number(val);
      i += 1;
    } else if (arg === '--out' && val !== undefined) {
      outPath = val;
      i += 1;
    } else {
      throw new Error(`Unknown or incomplete flag: ${arg}`);
    }
  }

  if (!Number.isInteger(seed)) throw new Error('--seed must be an integer.');
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('--duration must be > 0.');

  return { seed, duration, outPath };
}

function findBrowserBinary(): string {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  const candidates =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
        ]
      : process.platform === 'darwin'
        ? [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            '/Applications/Chromium.app/Contents/MacOS/Chromium'
          ]
        : ['google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge'];

  for (const c of candidates) {
    if (path.isAbsolute(c)) {
      if (fs.existsSync(c)) return c;
    } else {
      try {
        const resolved = execSync(`which ${c}`, { stdio: ['ignore', 'pipe', 'ignore'] })
          .toString()
          .trim();
        if (resolved) return resolved;
      } catch {
        // continue
      }
    }
  }

  throw new Error(
    'No Chromium/Chrome/Edge browser found. Set CHROME_PATH environment variable to run benchmark.'
  );
}

function sampleBrowserRssMb(pid: number): number | null {
  try {
    if (process.platform === 'win32') {
      const out = execSync(
        `powershell -NoProfile -Command "(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).WorkingSet64"`,
        { stdio: ['ignore', 'pipe', 'ignore'] }
      )
        .toString()
        .trim();
      const bytes = Number(out);
      return Number.isFinite(bytes) && bytes > 0 ? Math.round(bytes / (1024 * 1024)) : null;
    }
    const out = execSync(`ps -o rss= -p ${pid}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    const kb = Number(out);
    return Number.isFinite(kb) && kb > 0 ? Math.round(kb / 1024) : null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const distDir = path.resolve(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) {
    throw new Error('dist/ directory not found. Run "npm run build" first.');
  }

  const processStartMs = performance.now();
  const browserBin = findBrowserBinary();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-bench-'));

  let resolveBench!: (metrics: BrowserBenchMetrics) => void;
  let rejectBench!: (err: Error) => void;
  const benchPromise = new Promise<BrowserBenchMetrics>((res, rej) => {
    resolveBench = res;
    rejectBench = rej;
  });

  const server = http.createServer((req, res) => {
    const urlPath = (req.url ?? '/').split('?')[0];
    if (urlPath === '/api/bench-result' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => {
        body += String(chunk);
      });
      req.on('end', () => {
        try {
          const metrics = JSON.parse(body) as BrowserBenchMetrics;
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('{"ok":true}');
          resolveBench(metrics);
        } catch (err) {
          res.writeHead(400);
          res.end('Bad JSON');
          rejectBench(err as Error);
        }
      });
      return;
    }

    let filePath = path.join(distDir, urlPath === '/' ? 'index.html' : urlPath);
    if (!filePath.startsWith(distDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  await new Promise<void>((res) => server.listen(0, '127.0.0.1', () => res()));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 4173;
  const targetUrl = `http://127.0.0.1:${port}/?bench=1&seed=${args.seed}&duration=${args.duration}`;

  const browserProc = spawn(
    browserBin,
    [
      `--app=${targetUrl}`,
      '--window-size=1280,720',
      '--disable-gpu-vsync',
      '--disable-frame-rate-limit',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-background-timer-throttling',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${userDataDir}`
    ],
    { stdio: 'pipe' }
  );
  browserProc.stderr?.on('data', (d) => process.stderr.write(`[browser] ${String(d)}`));

  let peakMemMb: number | null = null;
  const memInterval = setInterval(() => {
    if (browserProc.pid) {
      const m = sampleBrowserRssMb(browserProc.pid);
      if (m !== null && (peakMemMb === null || m > peakMemMb)) {
        peakMemMb = m;
      }
    }
  }, 1000);

  const timeoutMs = (args.duration + 45) * 1000;
  const timeoutTimer = setTimeout(() => {
    rejectBench(new Error(`Benchmark timed out after ${timeoutMs / 1000}s.`));
  }, timeoutMs);

  try {
    const metrics = await benchPromise;
    const loadMs = Math.round(performance.now() - processStartMs - (args.duration + 3) * 1000);
    const safeLoadMs = Math.max(200, metrics.first_frame_rel_ms > 0 ? Math.round(metrics.first_frame_rel_ms) : loadMs);

    const benchResult = {
      contract_version: '1.3',
      avg_fps: metrics.avg_fps,
      p1_low_fps: metrics.p1_low_fps,
      frame_ms_p95: metrics.frame_ms_p95,
      frames: metrics.frames,
      load_ms: safeLoadMs,
      peak_mem_mb: peakMemMb,
      vsync_off: true,
      renderer: metrics.renderer,
      os: `${os.platform()} ${os.release()} (${os.arch()})`
    };

    const outAbs = path.resolve(process.cwd(), args.outPath);
    fs.mkdirSync(path.dirname(outAbs), { recursive: true });
    fs.writeFileSync(outAbs, `${JSON.stringify(benchResult, null, 2)}\n`, 'utf8');
    process.stdout.write(
      `Benchmark completed: avg_fps=${benchResult.avg_fps}, p1_low_fps=${benchResult.p1_low_fps}, frames=${benchResult.frames}, load_ms=${benchResult.load_ms}\n`
    );
  } finally {
    clearInterval(memInterval);
    clearTimeout(timeoutTimer);
    try {
      browserProc.kill();
    } catch {
      // ignore
    }
    server.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  process.stderr.write(`${(err as Error).message}\n`);
  process.exit(1);
});
