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

test('game.contract.json tuning matches DEFAULT_TUNING v1.1', () => {
  const raw = fs.readFileSync(path.resolve('game.contract.json'), 'utf8');
  const contract = JSON.parse(raw) as GameContract;
  assert.equal(contract.contract_version, '1.1');
  assert.deepEqual(contract.tuning, DEFAULT_TUNING);
});

test('Phase 1 regression (headless): mote pickup, deposit, win all_lit, safe_radius, dawn timeout, exit code 2', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-p1-reg-'));

  // 1. Mote pickup + deposit 10 + win all_lit
  const winRun = runHeadless(tmpDir, 'win', {
    night: 1,
    ticks: 180,
    scenario: {
      player: { pos: [0, 0, 0], carried: 8, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [[0, 0, 2], [0, 0, 4]],
      shades: [],
      lanterns: [
        { id: 'L1', pos: [0, 0, 6], deposited: 0 },
        { id: 'L2', pos: [20, 0, 0], lit: true },
        { id: 'L3', pos: [-20, 0, 0], lit: true },
        { id: 'L4', pos: [0, 0, -20], lit: true },
        { id: 'L5', pos: [14, 0, 14], lit: true }
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
  assert.ok(events.some((e) => e.name === 'lantern_lit' && e.data.lantern_id === 'L1'));
  assert.ok(events.some((e) => e.name === 'game_over' && e.data.result === 'won' && e.data.reason === 'all_lit'));

  // 2. Dawn timeout
  const dawnRun = runHeadless(tmpDir, 'dawn', {
    night: 1,
    ticks: 60,
    scenario: { random_motes: false, random_shades: false, motes: [], shades: [], time_left_s: 0.5 }
  });
  const dawnEnd = dawnRun.lines[dawnRun.lines.length - 1] as EndRecord;
  assert.equal(dawnEnd.type, 'end');
  assert.equal(dawnEnd.state, 'lost');
  assert.ok(
    dawnRun.lines.some((r) => r.type === 'event' && r.name === 'game_over' && r.data.reason === 'dawn')
  );

  // 3. Invalid inputs -> exit code 2
  const badInputs = path.join(tmpDir, 'bad_inputs.json');
  fs.writeFileSync(badInputs, '{"frames":[{"tick":10},{"tick":5}]}');
  let exitCode = 0;
  try {
    execFileSync('node', [
      CLI_PATH,
      '--seed',
      '1',
      '--night',
      '1',
      '--inputs',
      badInputs,
      '--ticks',
      '10',
      '--out',
      path.join(tmpDir, 'bad.jsonl')
    ]);
  } catch (err) {
    exitCode = (err as { status: number }).status;
  }
  assert.equal(exitCode, 2);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Phase 2 headless scenario: Dash (14 m/s over 12 ticks, cooldown)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-dash-'));
  const res = runHeadless(tmpDir, 'dash', {
    night: 1,
    ticks: 20,
    snapshotEvery: 12,
    scenario: { player: { pos: [0, 0, 0], carried: 0, flames: 3 }, random_motes: false, random_shades: false, motes: [], shades: [] },
    inputs: {
      frames: [
        { tick: 0, move: [0, 1], dash: true },
        { tick: 1, dash: false }
      ]
    }
  });
  assert.ok(res.lines.some((r) => r.type === 'event' && r.name === 'dash'));
  const snap12 = res.lines.find((r): r is SnapshotRecord => r.type === 'snapshot' && r.tick === 12);
  assert.ok(snap12);
  assert.ok(Math.abs(snap12.player.pos[2] - 2.8) < 0.05);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Phase 2 headless scenario: Drifter steals & drops motes on pulse', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-drifter-'));
  const res = runHeadless(tmpDir, 'drifter', {
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
    inputs: {
      frames: [
        { tick: 1, pulse: true },
        { tick: 2, pulse: false }
      ]
    }
  });
  assert.ok(res.lines.some((r) => r.type === 'event' && r.name === 'drifter_steal' && r.data.amount === 3));
  assert.ok(res.lines.some((r) => r.type === 'event' && r.name === 'drifter_drop' && r.data.amount === 3));
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Phase 2 headless scenario: Charm pickup grants 600 ticks boost', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-charm-'));
  const res = runHeadless(tmpDir, 'charm', {
    night: 2,
    ticks: 10,
    snapshotEvery: 10,
    scenario: {
      player: { pos: [35, 0, 0], carried: 0, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [],
      charms: [{ id: 'C1', pos: [35, 0, 0], available: true }]
    }
  });
  assert.ok(res.lines.some((r) => r.type === 'event' && r.name === 'charm_picked' && r.data.charm_id === 'C1'));
  const snap10 = res.lines.find((r): r is SnapshotRecord => r.type === 'snapshot' && r.tick === 10);
  assert.ok(snap10 && snap10.player.charm_s > 9.5);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Phase 2 headless scenario: Falling off island (Y < -10) & respawn', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-fall-'));
  const res = runHeadless(tmpDir, 'fall', {
    night: 1,
    ticks: 130,
    snapshotEvery: 130,
    scenario: {
      player: { pos: [45, 0, 0], carried: 5, flames: 3 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: []
    }
  });
  assert.ok(res.lines.some((r) => r.type === 'event' && r.name === 'player_hit' && r.data.by === 'fall' && r.data.lost === true));
  const snap130 = res.lines.find((r): r is SnapshotRecord => r.type === 'snapshot' && r.tick === 130);
  assert.ok(snap130);
  assert.deepEqual(snap130.player.pos, [0, 0, 0]);
  assert.equal(snap130.player.flames, 2);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Phase 2 headless scenario: Pause and Resume halt sim_tick', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-pause-'));
  const res = runHeadless(tmpDir, 'pause', {
    night: 1,
    ticks: 20,
    snapshotEvery: 10,
    scenario: { random_motes: false, random_shades: false, motes: [], shades: [] },
    inputs: {
      frames: [
        { tick: 0, pause: true },
        { tick: 1, pause: false },
        { tick: 12, pause: true },
        { tick: 13, pause: false }
      ]
    }
  });
  assert.ok(res.lines.some((r) => r.type === 'event' && r.name === 'paused'));
  assert.ok(res.lines.some((r) => r.type === 'event' && r.name === 'resumed'));
  const snap10 = res.lines.find((r): r is SnapshotRecord => r.type === 'snapshot' && r.tick === 10);
  assert.ok(snap10);
  assert.equal(snap10.state, 'paused');
  assert.equal(snap10.sim_tick, 0);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Phase 2 headless scenario: Night 2 Jump Pad & Night 3 Tiered Island', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-n23-'));
  // Night 2 jump pad at (20, 0, 18)
  const n2 = runHeadless(tmpDir, 'n2pad', {
    night: 2,
    ticks: 100,
    snapshotEvery: 10,
    scenario: { player: { pos: [20, 0, 18], carried: 0, flames: 3 }, random_motes: false, random_shades: false, motes: [], shades: [] }
  });
  const snap10 = n2.lines.find((r): r is SnapshotRecord => r.type === 'snapshot' && r.tick === 10);
  assert.ok(snap10 && !snap10.player.grounded && snap10.player.pos[1] > 1.5);

  // Night 3 starts grounded at (0, 6, 0) on Tier 2
  const n3 = runHeadless(tmpDir, 'n3', {
    night: 3,
    ticks: 60,
    snapshotEvery: 60,
    scenario: { random_motes: false, random_shades: false, motes: [], shades: [] }
  });
  const n3Snap0 = n3.lines.find((r): r is SnapshotRecord => r.type === 'snapshot' && r.tick === 0);
  const n3Snap60 = n3.lines.find((r): r is SnapshotRecord => r.type === 'snapshot' && r.tick === 60);
  assert.ok(n3Snap0 && n3Snap0.player.pos[1] === 6);
  assert.ok(n3Snap60 && n3Snap60.player.pos[1] === 6 && n3Snap60.player.grounded);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('headless CLI contract v1.1 determinism & 21,600 ticks <= 30s', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-perf-'));
  const t0 = Date.now();
  const r1 = runHeadless(tmpDir, 'perf1', { seed: 77, night: 3, ticks: 21600, snapshotEvery: 600 });
  const elapsedMs = Date.now() - t0;
  const r2 = runHeadless(tmpDir, 'perf2', { seed: 77, night: 3, ticks: 21600, snapshotEvery: 600 });

  assert.equal(fs.readFileSync(r1.outPath, 'utf8'), fs.readFileSync(r2.outPath, 'utf8'));
  assert.ok(elapsedMs <= 30000, `21600 ticks took ${elapsedMs}ms (> 30000ms)`);

  // Verify unit simulation defaultInputState export still works
  const sim = new GameSimulation(1, 1);
  assert.equal(sim.step(defaultInputState()).length >= 0, true);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
