import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_TUNING } from '../core/contract.js';
import { SeededRng } from '../core/rng.js';
import { GameSimulation, defaultInputState } from '../core/simulation.js';
import type { InputState } from '../core/types.js';

interface SoakArgs {
  seed: number;
  nights: number;
  outPath: string;
}

function parseArgs(argv: string[]): SoakArgs {
  let seed = 7;
  let nights = 10;
  let outPath = 'soak.json';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const val = argv[i + 1];
    if (arg === '--seed' && val !== undefined) {
      seed = Number(val);
      i += 1;
    } else if (arg === '--nights' && val !== undefined) {
      nights = Number(val);
      i += 1;
    } else if (arg === '--out' && val !== undefined) {
      outPath = val;
      i += 1;
    } else {
      throw new Error(`Unknown or incomplete flag: ${arg}`);
    }
  }

  if (!Number.isInteger(seed)) throw new Error('--seed must be an integer.');
  if (!Number.isInteger(nights) || nights < 1) throw new Error('--nights must be >= 1.');

  return { seed, nights, outPath };
}

function rssMb(): number {
  return Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const startWallMs = performance.now();
  const results: Array<'won' | 'lost'> = [];
  let crashes = 0;
  let memStartMb = 0;
  let memEndMb = 0;

  for (let i = 0; i < args.nights; i++) {
    const night = (i % 3) + 1;
    const nightSeed = args.seed + i;
    const inputRng = new SeededRng(nightSeed + 1000);
    const durationS =
      night === 1
        ? DEFAULT_TUNING.night1_duration_s
        : night === 2
          ? DEFAULT_TUNING.night2_duration_s
          : DEFAULT_TUNING.night3_duration_s;
    const maxTicks = durationS * 60 + 60;

    let sim: GameSimulation | null = new GameSimulation(nightSeed, night);
    if (i === 0) {
      memStartMb = rssMb();
    }

    let move: [number, number] = [0, 0];
    try {
      for (let t = 0; t < maxTicks; t++) {
        if (t % 30 === 0) {
          const angle = inputRng.next() * Math.PI * 2;
          move = [Math.cos(angle), Math.sin(angle)];
        }
        const input: InputState = {
          ...defaultInputState(),
          move,
          jump: inputRng.next() < 0.05,
          dash: inputRng.next() < 0.03,
          pulse: inputRng.next() < 0.02,
          interact: inputRng.next() < 0.1
        };
        sim.step(input);
        if (sim.state === 'won' || sim.state === 'lost') {
          break;
        }
      }
      results.push(sim.state === 'won' ? 'won' : 'lost');
    } catch {
      crashes += 1;
      results.push('lost');
    } finally {
      sim = null;
    }

    if (i === args.nights - 1) {
      if (typeof global.gc === 'function') global.gc();
      memEndMb = rssMb();
    }
  }

  const durationS = Math.round(((performance.now() - startWallMs) / 1000) * 10) / 10;
  const output = {
    nights: args.nights,
    crashes,
    results,
    mem_start_mb: memStartMb,
    mem_end_mb: memEndMb,
    duration_s: durationS
  };

  const outAbs = path.resolve(process.cwd(), args.outPath);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  process.stdout.write(
    `Soak completed: ${args.nights} nights, crashes=${crashes}, mem=${memStartMb}->${memEndMb} MB, ${durationS}s\n`
  );
}

main();
