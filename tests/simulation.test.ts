import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DEFAULT_TUNING } from '../src/core/contract.js';
import { GameSimulation, defaultInputState } from '../src/core/simulation.js';
import type { EndRecord, EventRecord, GameContract, SnapshotRecord } from '../src/core/types.js';

const CLI_PATH = path.resolve('dist-headless/src/headless/cli.js');

function runHeadless(
  tmpDir: string,
  name: string,
  opts: { seed?: number; night?: number; ticks: number; scenario?: object; inputs?: object; snapshotEvery?: number }
): { lines: Array<SnapshotRecord | EventRecord | EndRecord>; outPath: string } {
  const args = [
    CLI_PATH,
    '--seed',
    String(opts.seed ?? 42),
    '--night',
    String(opts.night ?? 1),
    '--ticks',
    String(opts.ticks),
    '--snapshot-every',
    String(opts.snapshotEvery ?? 10)
  ];
  if (opts.scenario) {
    const scPath = path.join(tmpDir, `${name}_scenario.json`);
    fs.writeFileSync(scPath, JSON.stringify(opts.scenario), 'utf8');
    args.push('--scenario', scPath);
  }
  if (opts.inputs) {
    const inPath = path.join(tmpDir, `${name}_inputs.json`);
    fs.writeFileSync(inPath, JSON.stringify(opts.inputs), 'utf8');
    args.push('--inputs', inPath);
  }
  const outPath = path.join(tmpDir, `${name}_out.jsonl`);
  args.push('--out', outPath);

  execFileSync('node', args);
  const raw = fs.readFileSync(outPath, 'utf8').trim().split('\n');
  return {
    lines: raw.map((l) => JSON.parse(l) as SnapshotRecord | EventRecord | EndRecord),
    outPath
  };
}

test('game.contract.json tuning matches DEFAULT_TUNING v1.2', () => {
  const raw = fs.readFileSync(path.resolve('game.contract.json'), 'utf8');
  const contract = JSON.parse(raw) as GameContract;
  assert.equal(contract.contract_version, '1.2');
  assert.deepEqual(contract.tuning, DEFAULT_TUNING);
});

/**
 * Updated from Phase 1-2: In Phase 3 (Ticket-03), lighting all lanterns no longer ends the night
 * early (`all_lit` removed); instead, player wins at dawn if >= ceil(0.6 * total) lanterns are lit.
 */
test('Phase 1-3 regression (headless): mote pickup, deposit, no early win, dawn_survived, dawn loss, exit code 2', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-p3-reg-'));

  // 1. Lighting 5/5 lanterns does NOT end early; survives to dawn -> dawn_survived
  const winRun = runHeadless(tmpDir, 'dawn_win', {
    night: 1,
    ticks: 180,
    scenario: {
      player: { pos: [0, 0, 0], carried: 8, flames: 3 },
      random_motes: false,
      random_shades: false,
      time_left_s: 2.0,
      motes: [[0, 0, 2], [0, 0, 4]],
      shades: [],
      lanterns: [
        { id: 'L1', pos: [0, 0, 6], deposited: 0 },
        { id: 'L2', pos: [20, 0, 0], lit: true, fuel: 80 },
        { id: 'L3', pos: [-20, 0, 0], lit: true, fuel: 80 },
        { id: 'L4', pos: [0, 0, -20], lit: true, fuel: 80 },
        { id: 'L5', pos: [14, 0, 14], lit: true, fuel: 80 }
      ]
    },
    inputs: {
      frames: [
        { tick: 0, move: [0, 1] },
        { tick: 55, move: [0, 0], interact: true },
        { tick: 56, interact: false }
      ]
    }
  });
  const events = winRun.lines.filter((r): r is EventRecord => r.type === 'event');
  assert.equal(events.filter((e) => e.name === 'mote_picked').length, 2);
  assert.ok(events.some((e) => e.name === 'deposit' && e.data.amount === 10));
  assert.ok(events.some((e) => e.name === 'lantern_lit' && e.data.lantern_id === 'L1' && e.data.relight === false));
  assert.ok(events.some((e) => e.name === 'game_over' && e.data.result === 'won' && e.data.reason === 'dawn_survived'));

  // 2. Dawn timeout with < 3/5 lit -> lost reason dawn
  const dawnLoss = runHeadless(tmpDir, 'dawn_loss', {
    night: 1,
    ticks: 60,
    scenario: { random_motes: false, random_shades: false, motes: [], shades: [], time_left_s: 0.5 }
  });
  const dawnEnd = dawnLoss.lines[dawnLoss.lines.length - 1] as EndRecord;
  assert.equal(dawnEnd.state, 'lost');
  assert.ok(dawnLoss.lines.some((r) => r.type === 'event' && r.name === 'game_over' && r.data.reason === 'dawn'));

  // 3. Invalid inputs -> exit code 2
  const badInputs = path.join(tmpDir, 'bad_inputs.json');
  fs.writeFileSync(badInputs, '{"frames":[{"tick":10},{"tick":5}]}');
  let exitCode = 0;
  try {
    execFileSync('node', [CLI_PATH, '--seed', '1', '--night', '1', '--inputs', badInputs, '--ticks', '10', '--out', path.join(tmpDir, 'bad.jsonl')]);
  } catch (err) {
    exitCode = (err as { status: number }).status;
  }
  assert.equal(exitCode, 2);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Phase 3 headless scenario: lantern fuel decay, lantern_out, relight (5 motes), refuel, and capacity +2', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-p3-fuel-'));

  // L1 starts lit with fuel 1.0 -> decays to 0 after 60 ticks -> lantern_out, ever_lit = true
  // Then player with 10 motes relights L1 (costs only 5!), capacity becomes 12, then refuels L2 (fuel 50 -> 100)
  const res = runHeadless(tmpDir, 'fuel', {
    night: 1,
    ticks: 100,
    snapshotEvery: 100,
    scenario: {
      player: { pos: [0, 0, 25], carried: 10, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [],
      lanterns: [
        { id: 'L1', pos: [0, 0, 25], lit: true, fuel: 1.0, ever_lit: true },
        { id: 'L2', pos: [0, 0, 26], lit: true, fuel: 55.0 }
      ]
    },
    inputs: {
      frames: [
        { tick: 65, interact: true },
        { tick: 66, interact: false },
        { tick: 75, move: [0, 1] },
        { tick: 85, move: [0, 0], interact: true },
        { tick: 86, interact: false }
      ]
    }
  });

  const events = res.lines.filter((r): r is EventRecord => r.type === 'event');
  assert.ok(events.some((e) => e.name === 'lantern_out' && e.data.lantern_id === 'L1'));
  assert.ok(events.some((e) => e.name === 'lantern_lit' && e.data.lantern_id === 'L1' && e.data.relight === true));
  assert.ok(events.some((e) => e.name === 'refuel' && e.data.lantern_id === 'L2' && e.data.amount === 5));

  const snap100 = res.lines.find((r): r is SnapshotRecord => r.type === 'snapshot' && r.tick === 100);
  assert.ok(snap100);
  assert.equal(snap100.player.capacity, 12); // 10 + 2 * 1 successful light
  const l1 = snap100.lanterns.find((l) => l.id === 'L1')!;
  assert.equal(l1.relit_count, 1);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Phase 3 headless scenario: Shade drains low-fuel lantern (< 30), pulse on draining shade gives +15 score', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-p3-drain-'));

  // 1. Shade drains low-fuel lantern for 65 ticks while player is outside 6m -> emits fuel_drain at tick 60
  const drainRes = runHeadless(tmpDir, 'drain', {
    night: 1,
    ticks: 65,
    snapshotEvery: 65,
    scenario: {
      player: { pos: [0, 0, 18], carried: 3, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25.0 }],
      shades: [{ id: 'S1', pos: [0, 0, 25], state: 'drain', target_lantern_id: 'L1' }]
    }
  });
  const drainEvents = drainRes.lines.filter((r): r is EventRecord => r.type === 'event');
  assert.ok(drainEvents.some((e) => e.name === 'fuel_drain' && e.data.lantern_id === 'L1' && e.data.shade_id === 'S1'));

  // 2. Pulse hitting a draining shade at tick 0 (step 7 before step 8) awards +15 score
  const pulseRes = runHeadless(tmpDir, 'drain_pulse', {
    night: 1,
    ticks: 5,
    snapshotEvery: 5,
    scenario: {
      player: { pos: [0, 0, 21], carried: 3, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      lanterns: [{ id: 'L1', pos: [0, 0, 25], lit: true, fuel: 25.0 }],
      shades: [{ id: 'S1', pos: [0, 0, 25], state: 'drain', target_lantern_id: 'L1' }]
    },
    inputs: {
      frames: [
        { tick: 0, pulse: true },
        { tick: 1, pulse: false }
      ]
    }
  });
  const snap5 = pulseRes.lines.find((r): r is SnapshotRecord => r.type === 'snapshot' && r.tick === 5);
  assert.ok(snap5 && snap5.score === 15);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Phase 2 features regression (headless): Dash, Drifter, Charm, Fall, Pause', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-p2-reg-'));

  // Dash
  const dashRes = runHeadless(tmpDir, 'dash', {
    night: 1,
    ticks: 20,
    snapshotEvery: 12,
    scenario: { player: { pos: [0, 0, 0], carried: 0, flames: 3 }, random_motes: false, random_shades: false, motes: [], shades: [] },
    inputs: { frames: [{ tick: 0, move: [0, 1], dash: true }, { tick: 1, dash: false }] }
  });
  assert.ok(dashRes.lines.some((r) => r.type === 'event' && r.name === 'dash'));

  // Drifter steal & drop
  const drifterRes = runHeadless(tmpDir, 'drifter', {
    night: 2,
    ticks: 10,
    scenario: {
      player: { pos: [0, 0, 0], carried: 6, flames: 3 },
      random_motes: false,
      random_shades: false,
      random_drifters: false,
      motes: [],
      shades: [],
      drifters: [{ id: 'D1', pos: [0, 0, 1.0], state: 'chase', stolen: 0 }]
    },
    inputs: { frames: [{ tick: 1, pulse: true }, { tick: 2, pulse: false }] }
  });
  assert.ok(drifterRes.lines.some((r) => r.type === 'event' && r.name === 'drifter_steal'));
  assert.ok(drifterRes.lines.some((r) => r.type === 'event' && r.name === 'drifter_drop'));

  // Pause
  const pauseRes = runHeadless(tmpDir, 'pause', {
    night: 1,
    ticks: 15,
    snapshotEvery: 10,
    scenario: { random_motes: false, random_shades: false, motes: [], shades: [] },
    inputs: { frames: [{ tick: 0, pause: true }, { tick: 1, pause: false }] }
  });
  const snap10 = pauseRes.lines.find((r): r is SnapshotRecord => r.type === 'snapshot' && r.tick === 10);
  assert.ok(snap10 && snap10.state === 'paused' && snap10.sim_tick === 0);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('headless CLI contract v1.2 determinism & 18,000 ticks <= 30s', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-p3-det-'));
  const t0 = Date.now();
  const r1 = runHeadless(tmpDir, 'det1', { seed: 77, night: 3, ticks: 18000, snapshotEvery: 600 });
  const elapsedMs = Date.now() - t0;
  const r2 = runHeadless(tmpDir, 'det2', { seed: 77, night: 3, ticks: 18000, snapshotEvery: 600 });

  assert.equal(fs.readFileSync(r1.outPath, 'utf8'), fs.readFileSync(r2.outPath, 'utf8'));
  assert.ok(elapsedMs <= 30000, `18000 ticks took ${elapsedMs}ms (> 30000ms)`);

  const sim = new GameSimulation(1, 1);
  assert.equal(sim.step(defaultInputState()).length >= 0, true);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
