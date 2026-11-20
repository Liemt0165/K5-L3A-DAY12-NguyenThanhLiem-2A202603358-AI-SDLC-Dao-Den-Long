import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_TUNING } from '../core/contract.js';
import { GameSimulation, defaultInputState } from '../core/simulation.js';
import type { InputFrame, InputState, InputsFile, ScenarioConfig } from '../core/types.js';

class InputFormatError extends Error {}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function parseInputsFile(filePath: string): Map<number, InputFrame> {
  let rawText: string;
  try {
    rawText = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new InputFormatError(`Cannot read inputs file '${filePath}': ${(err as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new InputFormatError(`Invalid JSON in inputs file: ${(err as Error).message}`);
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as InputsFile).frames)) {
    throw new InputFormatError('Inputs file must be an object with a "frames" array.');
  }

  const map = new Map<number, InputFrame>();
  let prevTick = -1;

  for (const frame of (parsed as InputsFile).frames) {
    if (!frame || typeof frame !== 'object') {
      throw new InputFormatError('Each frame must be an object.');
    }
    if (!Number.isInteger(frame.tick) || frame.tick < 0) {
      throw new InputFormatError(`Invalid frame tick: ${String(frame.tick)}`);
    }
    if (frame.tick <= prevTick) {
      throw new InputFormatError(
        `Frame ticks must be strictly increasing (got ${frame.tick} after ${prevTick}).`
      );
    }
    prevTick = frame.tick;

    if (frame.move !== undefined) {
      if (
        !Array.isArray(frame.move) ||
        frame.move.length !== 2 ||
        !isFiniteNumber(frame.move[0]) ||
        !isFiniteNumber(frame.move[1]) ||
        frame.move[0] < -1 ||
        frame.move[0] > 1 ||
        frame.move[1] < -1 ||
        frame.move[1] > 1
      ) {
        throw new InputFormatError(`Invalid move vector at tick ${frame.tick}.`);
      }
    }

    if (frame.cam_yaw_deg !== undefined && !isFiniteNumber(frame.cam_yaw_deg)) {
      throw new InputFormatError(`Invalid cam_yaw_deg at tick ${frame.tick}.`);
    }

    for (const key of ['jump', 'interact', 'pulse', 'dash', 'pause'] as const) {
      if (frame[key] !== undefined && typeof frame[key] !== 'boolean') {
        throw new InputFormatError(`Field "${key}" must be boolean at tick ${frame.tick}.`);
      }
    }

    map.set(frame.tick, frame);
  }

  return map;
}

function parseScenarioFile(filePath: string): ScenarioConfig {
  let rawText: string;
  try {
    rawText = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new InputFormatError(`Cannot read scenario file '${filePath}': ${(err as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new InputFormatError(`Invalid JSON in scenario file: ${(err as Error).message}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new InputFormatError('Scenario file must be a JSON object.');
  }

  const sc = parsed as ScenarioConfig;
  return sc;
}

interface CliArgs {
  seed: number;
  night: number;
  scenarioPath?: string;
  inputsPath?: string;
  ticks: number;
  outPath: string;
  snapshotEvery: number;
}

function parseCliArgs(argv: string[]): CliArgs {
  const map = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      throw new Error(`Unexpected argument: ${arg}`);
    }
    const val = argv[i + 1];
    if (val === undefined || val.startsWith('--')) {
      throw new Error(`Missing value for flag ${arg}`);
    }
    map.set(arg, val);
    i += 1;
  }

  const seedRaw = map.get('--seed');
  const nightRaw = map.get('--night');
  const ticksRaw = map.get('--ticks');
  const outPath = map.get('--out');

  if (seedRaw === undefined || nightRaw === undefined || ticksRaw === undefined || outPath === undefined) {
    throw new Error('Required flags: --seed <int> --night <int> --ticks <int> --out <file.jsonl>');
  }

  const seed = Number(seedRaw);
  const night = Number(nightRaw);
  const ticks = Number(ticksRaw);
  const snapshotEveryRaw = map.get('--snapshot-every');
  const snapshotEvery = snapshotEveryRaw !== undefined ? Number(snapshotEveryRaw) : 10;

  if (!Number.isInteger(seed)) throw new Error('--seed must be an integer.');
  if (!Number.isInteger(night) || night < 1 || night > 3) throw new Error('--night must be 1, 2, or 3.');
  if (!Number.isInteger(ticks) || ticks < 0) throw new Error('--ticks must be a non-negative integer.');
  if (!Number.isInteger(snapshotEvery) || snapshotEvery < 1) {
    throw new Error('--snapshot-every must be a positive integer.');
  }

  return {
    seed,
    night,
    scenarioPath: map.get('--scenario'),
    inputsPath: map.get('--inputs'),
    ticks,
    outPath,
    snapshotEvery
  };
}

function main(): void {
  let args: CliArgs;
  try {
    args = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`CLI error: ${(err as Error).message}`);
    process.exit(1);
  }

  let scenario: ScenarioConfig | undefined;
  let frameMap = new Map<number, InputFrame>();

  try {
    if (args.scenarioPath) {
      scenario = parseScenarioFile(args.scenarioPath);
    }
    if (args.inputsPath) {
      frameMap = parseInputsFile(args.inputsPath);
    }
  } catch (err) {
    if (err instanceof InputFormatError) {
      console.error(`Format error: ${err.message}`);
      process.exit(2);
    }
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }

  const sim = new GameSimulation(args.seed, args.night, scenario, DEFAULT_TUNING);
  const lines: string[] = [];

  // Snapshot tick 0
  lines.push(JSON.stringify(sim.getSnapshot(0)));

  const currentInput: InputState = defaultInputState();

  for (let k = 0; k < args.ticks; k++) {
    if (sim.state === 'won' || sim.state === 'lost') {
      break;
    }

    const frame = frameMap.get(k);
    if (frame) {
      if (frame.move !== undefined) currentInput.move = [frame.move[0], frame.move[1]];
      if (frame.cam_yaw_deg !== undefined) currentInput.cam_yaw_deg = frame.cam_yaw_deg;
      if (frame.jump !== undefined) currentInput.jump = frame.jump;
      if (frame.interact !== undefined) currentInput.interact = frame.interact;
      if (frame.pulse !== undefined) currentInput.pulse = frame.pulse;
      if (frame.dash !== undefined) currentInput.dash = frame.dash;
      if (frame.pause !== undefined) currentInput.pause = frame.pause;
    }

    const events = sim.step(currentInput);
    for (const ev of events) {
      lines.push(JSON.stringify(ev));
    }

    if ((k + 1) % args.snapshotEvery === 0) {
      lines.push(JSON.stringify(sim.getSnapshot(k + 1)));
    }
  }

  lines.push(JSON.stringify(sim.getEndRecord()));

  try {
    const outDir = path.dirname(args.outPath);
    if (outDir && outDir !== '.') {
      fs.mkdirSync(outDir, { recursive: true });
    }
    fs.writeFileSync(args.outPath, lines.join('\n') + '\n', 'utf8');
  } catch (err) {
    console.error(`Failed to write output '${args.outPath}': ${(err as Error).message}`);
    process.exit(1);
  }

  process.exit(0);
}

main();
